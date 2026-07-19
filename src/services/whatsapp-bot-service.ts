import { createAdminClient } from "@/lib/supabase/admin";
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
import type { BotAccount, BotIncomingMessage, WhatsAppWebhookPayload } from "@/types/telegram-bot";

import { createHash } from "node:crypto";

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
