import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { resolveBotBrandIdentity } from "@/services/bot/branding";
import { WhatsAppAdapter } from "@/services/bot/whatsapp-adapter";
import { parseWhatsAppEvents, type WhatsAppEvent } from "@/services/bot/whatsapp-parse";
import {
  findRole,
  getConversation,
  processCallback,
  processConnectedMessage,
  roleMenu,
  sendAndLog,
} from "@/services/telegram-bot-service";
import type {
  BotAccount,
  BotIncomingMessage,
  GenerateTelegramInvitationInput,
  WhatsAppWebhookPayload,
} from "@/types/telegram-bot";

import { createHash, randomBytes } from "node:crypto";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function nowIso() {
  return new Date().toISOString();
}
function safeError(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inconnue.";
}

type AdminClient = ReturnType<typeof createAdminClient>;

type WhatsAppAccountRow = {
  id: string;
  organization_id: string;
  profile_id: string;
};

export type WhatsAppSettingsPayload = {
  accounts: Array<Record<string, unknown>>;
  invitations: Array<Record<string, unknown>>;
  members: Array<{
    organization_id: string;
    profile_id: string;
    member_type: string;
    full_name: string | null;
    email: string | null;
    organization_name: string | null;
  }>;
  botNumber: string | null;
};

/**
 * Génère une invitation de liaison WhatsApp (même table que Telegram, channel = whatsapp).
 * Le lien wa.me ouvre WhatsApp avec le code pré-rempli : le membre n'a qu'à l'envoyer au bot.
 * RLS : réservé aux profils avec can_manage_users sur l'organisation.
 */
export async function generateWhatsAppInvitation(input: GenerateTelegramInvitationInput) {
  const supabase = await createUserClient();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 30) * 60_000).toISOString();

  const { data, error } = await supabase
    .from("telegram_link_invitations" as never)
    .insert({
      organization_id: input.organization_id,
      profile_id: input.profile_id,
      token_hash: hash(token),
      expires_at: expiresAt,
      channel: "whatsapp",
    } as never)
    .select("id,organization_id,profile_id,status,expires_at,created_at")
    .single();
  if (error) throw error;

  const botNumber = process.env.WHATSAPP_BOT_NUMBER;
  return {
    invitation: data,
    waLink: botNumber ? `https://wa.me/${botNumber}?text=${encodeURIComponent(token)}` : null,
    token,
  };
}

/** Données de la page réglages WhatsApp (lues sous RLS : chacun ne voit que son périmètre). */
export async function listWhatsAppSettingsData(): Promise<WhatsAppSettingsPayload> {
  const supabase = await createUserClient();
  const [accounts, invitations, members] = await Promise.all([
    supabase
      .from("whatsapp_accounts" as never)
      .select("id,organization_id,profile_id,wa_id,display_name,status,linked_at,last_activity_at")
      .order("linked_at", { ascending: false })
      .limit(200),
    supabase
      .from("telegram_link_invitations" as never)
      .select("id,organization_id,profile_id,status,expires_at,created_at")
      .eq("channel", "whatsapp")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("organization_members")
      .select("organization_id,profile_id,member_type,profiles(full_name,email),organizations(name)")
      .eq("status", "active")
      .is("archived_at", null)
      .limit(500),
  ]);
  for (const result of [accounts, invitations, members]) {
    if (result.error) throw result.error;
  }

  return {
    accounts: (accounts.data ?? []) as Array<Record<string, unknown>>,
    invitations: (invitations.data ?? []) as Array<Record<string, unknown>>,
    members: (members.data ?? []).map((member) => {
      const profile = member.profiles as { full_name?: string | null; email?: string | null } | null;
      const organization = member.organizations as { name?: string | null } | null;
      return {
        organization_id: member.organization_id,
        profile_id: member.profile_id,
        member_type: member.member_type,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        organization_name: organization?.name ?? null,
      };
    }),
    botNumber: process.env.WHATSAPP_BOT_NUMBER ?? null,
  };
}

/**
 * Point d'entrée WhatsApp : sécurité (faite au webhook), anti-doublon par wamid,
 * liaison de compte par code, puis délégation au cœur métier partagé avec Telegram
 * (incidents, documents, créneaux) via processConnectedMessage/processCallback.
 */
export async function processWhatsAppUpdate(payload: WhatsAppWebhookPayload) {
  const supabase = createAdminClient();
  const adapter = new WhatsAppAdapter();
  const events = parseWhatsAppEvents(payload);
  const results: Array<Record<string, unknown>> = [];

  for (const event of events) {
    results.push(await handleEvent(supabase, adapter, event));
  }
  return { handled: results.length, results };
}

async function handleEvent(supabase: AdminClient, adapter: WhatsAppAdapter, event: WhatsAppEvent) {
  // Anti-doublon : chaque message WhatsApp (wamid) n'est traité qu'une fois.
  const webhook = await supabase
    .from("bot_webhook_updates")
    .insert({
      channel: "whatsapp",
      external_update_id: event.messageId,
      external_user_id: event.waId,
      payload_hash: hash(JSON.stringify(event)),
      status: "processing",
    })
    .select("id")
    .single();
  if (webhook.error?.code === "23505") return { duplicate: true };
  if (webhook.error) throw webhook.error;

  try {
    const result = await route(supabase, adapter, event, webhook.data.id);
    await supabase
      .from("bot_webhook_updates")
      .update({ status: "processed", processed_at: nowIso() })
      .eq("id", webhook.data.id);
    return result;
  } catch (error) {
    await Promise.all([
      supabase
        .from("bot_webhook_updates")
        .update({ status: "error", error_code: "PROCESSING_FAILED", processed_at: nowIso() })
        .eq("id", webhook.data.id),
      supabase.from("bot_errors").insert({
        error_code: "PROCESSING_FAILED",
        safe_message: "Le traitement du message WhatsApp a echoue.",
        internal_details: { message: safeError(error), messageId: event.messageId },
      }),
    ]);
    try {
      await adapter.sendMessage({
        chatId: event.waId,
        text: "Une erreur est survenue. Aucun dossier n'a ete invente ni cree. Reessayez ou contactez votre responsable.",
      });
    } catch {
      // L'erreur reste tracee dans bot_webhook_updates et bot_errors.
    }
    return { error: true };
  }
}

async function route(supabase: AdminClient, adapter: WhatsAppAdapter, event: WhatsAppEvent, webhookId: string) {
  const accountRow = await findWhatsAppAccount(supabase, event.waId);

  // Non lié : tenter une liaison si le message ressemble à un code d'invitation.
  if (!accountRow) {
    const token = extractLinkToken(event);
    if (token) {
      const linked = await confirmWhatsAppLink(supabase, token, event);
      if (linked) {
        const account = toBotAccount(linked, event.waId);
        const role = await findRole(supabase, account);
        const conversation = await getConversation(supabase, account, role);
        const identity = await resolveBotBrandIdentity(supabase, account.organization_id, role);
        await sendAndLog(
          supabase,
          adapter,
          conversation,
          {
            ...roleMenu(role),
            text: `${identity.welcomeMessage}\n\nVotre compte WhatsApp est maintenant lie. Que souhaitez-vous faire ?`,
          },
          event.waId,
        );
        return { linked: true };
      }
    }
    await adapter.sendMessage({
      chatId: event.waId,
      text: "Compte non reconnu. Utilisez le lien personnel genere depuis GERIMMO pour lier votre WhatsApp.",
    });
    return { unrecognized: true };
  }

  await supabase
    .from("whatsapp_accounts")
    .update({ last_activity_at: nowIso(), display_name: event.contactName ?? undefined })
    .eq("id", accountRow.id);

  const account = toBotAccount(accountRow, event.waId);

  // Un bouton/ligne de liste WhatsApp équivaut à un callback Telegram (pas d'accusé à renvoyer).
  if (event.callbackData) {
    await processCallback(supabase, adapter, account, event.callbackData, null, webhookId);
    return { processed: true, kind: "callback" };
  }

  await processConnectedMessage(supabase, adapter, account, toIncomingMessage(event), webhookId);
  return { processed: true, kind: event.kind };
}

function toBotAccount(row: WhatsAppAccountRow, waId: string): BotAccount {
  return {
    id: row.id,
    channel: "whatsapp",
    organization_id: row.organization_id,
    profile_id: row.profile_id,
    replyTarget: waId,
  };
}

/** Normalise un événement WhatsApp vers la forme neutre partagée avec Telegram. */
function toIncomingMessage(event: WhatsAppEvent): BotIncomingMessage {
  return {
    externalMessageId: event.messageId,
    text: event.media ? null : event.text,
    caption: event.media?.caption ?? null,
    attachment: event.media
      ? {
          kind: event.media.kind === "image" ? "photo" : "document",
          fileId: event.media.id,
          fileUniqueId: event.media.id,
          fileName: event.media.fileName,
          mimeType: event.media.mimeType,
          fileSize: null,
        }
      : null,
    metadata: { wamid: event.messageId },
  };
}

async function findWhatsAppAccount(supabase: AdminClient, waId: string) {
  const { data } = await supabase
    .from("whatsapp_accounts")
    .select("id,organization_id,profile_id")
    .eq("wa_id", waId)
    .eq("status", "connected")
    .maybeSingle();
  return (data as WhatsAppAccountRow | null) ?? null;
}

/** Le premier message peut être un code de liaison (mot alphanumérique). */
function extractLinkToken(event: WhatsAppEvent): string | null {
  if (event.callbackData?.startsWith("link:")) return event.callbackData.slice(5);
  const match = event.text?.trim().match(/^([A-Za-z0-9_-]{8,})$/);
  return match?.[1] ?? null;
}

async function confirmWhatsAppLink(supabase: AdminClient, token: string, event: WhatsAppEvent) {
  const invitation = await supabase
    .from("telegram_link_invitations")
    .select("id,organization_id,profile_id,expires_at,status")
    .eq("token_hash", hash(token))
    .eq("status", "pending")
    .maybeSingle();
  if (!invitation.data || new Date(invitation.data.expires_at).getTime() <= Date.now()) return null;

  const account = await supabase
    .from("whatsapp_accounts")
    .insert({
      organization_id: invitation.data.organization_id,
      profile_id: invitation.data.profile_id,
      invitation_id: invitation.data.id,
      wa_id: event.waId,
      display_name: event.contactName,
      status: "connected",
    })
    .select("id,organization_id,profile_id")
    .single();
  if (account.error) throw account.error;

  await supabase
    .from("telegram_link_invitations")
    .update({ status: "confirmed", confirmed_at: nowIso() })
    .eq("id", invitation.data.id);
  return account.data as WhatsAppAccountRow;
}
