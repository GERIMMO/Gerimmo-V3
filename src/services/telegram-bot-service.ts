import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { applyBrandIdentity } from "@/services/bot/brand-rules";
import { resolveBotBrandIdentity } from "@/services/bot/branding";
import type { BotChannelAdapter } from "@/services/bot/channel";
import { roleMenu } from "@/services/bot/menus";
import {
  allowedTenantDocumentTypes,
  classifyMessage,
  parseAvailabilitySlots,
  parseEurosToCents,
} from "@/services/bot/message-understanding";
import { TelegramAdapter } from "@/services/bot/telegram-adapter";
import type {
  BotAccount,
  BotAdminPayload,
  BotConversation,
  BotIncomingMessage,
  BotOutgoingMessage,
  GenerateTelegramInvitationInput,
  TelegramAccount,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from "@/types/telegram-bot";

import { createHash, randomBytes } from "node:crypto";

const maximumAttachmentBytes = 10 * 1024 * 1024;
const allowedAttachmentMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue";
}

export async function generateTelegramInvitation(input: GenerateTelegramInvitationInput) {
  const supabase = await createUserClient();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 30) * 60_000).toISOString();
  const username = process.env.TELEGRAM_BOT_USERNAME;

  const { data, error } = await supabase
    .from("telegram_link_invitations" as never)
    .insert({
      organization_id: input.organization_id,
      profile_id: input.profile_id,
      token_hash: hash(token),
      expires_at: expiresAt,
    } as never)
    .select("id,organization_id,profile_id,status,expires_at,created_at")
    .single();

  if (error) throw error;

  return {
    invitation: data,
    secureLink: username ? `https://t.me/${username}?start=${token}` : null,
    token,
  };
}

export async function revokeTelegramInvitation(invitationId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("telegram_link_invitations" as never)
    .update({ status: "revoked", revoked_at: nowIso() } as never)
    .eq("id", invitationId)
    .eq("status", "pending")
    .select("id,status,revoked_at")
    .single();
  if (error) throw error;
  return data;
}

export async function listTelegramAdminData(): Promise<BotAdminPayload> {
  const supabase = await createUserClient();
  const [accounts, conversations, messages, errors] = await Promise.all([
    supabase
      .from("telegram_accounts" as never)
      .select("id,organization_id,profile_id,status,linked_at,last_activity_at,revoked_at")
      .order("last_activity_at", { ascending: false })
      .limit(200),
    supabase
      .from("bot_conversations" as never)
      .select("id,organization_id,profile_id,role_key,intent,state,status,last_activity_at")
      .order("last_activity_at", { ascending: false })
      .limit(200),
    supabase
      .from("bot_messages" as never)
      .select("id,organization_id,conversation_id,profile_id,direction,message_type,status,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("bot_errors" as never)
      .select("id,organization_id,conversation_id,error_code,safe_message,status,retry_count,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  for (const result of [accounts, conversations, messages, errors]) {
    if (result.error) throw result.error;
  }
  return {
    accounts: (accounts.data ?? []) as Array<Record<string, unknown>>,
    conversations: (conversations.data ?? []) as Array<Record<string, unknown>>,
    messages: (messages.data ?? []) as Array<Record<string, unknown>>,
    errors: (errors.data ?? []) as Array<Record<string, unknown>>,
  };
}

export async function retryBotError(errorId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("bot_errors" as never)
    .update({ status: "retry_pending", last_retry_at: nowIso() } as never)
    .eq("id", errorId)
    .select("id,status,retry_count,last_retry_at")
    .single();
  if (error) throw error;
  return data;
}

type AdminClient = ReturnType<typeof createAdminClient>;

function channelLabel(channel: BotChannelAdapter["channel"]) {
  return channel === "whatsapp" ? "WhatsApp" : "Telegram";
}

/** Colonne de rattachement du compte dans bot_conversations selon le canal. */
function accountColumn(channel: BotAccount["channel"]) {
  return channel === "whatsapp" ? "whatsapp_account_id" : "telegram_account_id";
}

/** Réparti l'identifiant de message externe sur la bonne colonne (bigint Telegram / texte sinon). */
function externalIdColumns(externalMessageId: number | string) {
  return typeof externalMessageId === "number"
    ? { telegram_message_id: externalMessageId }
    : { external_message_id: externalMessageId };
}

export async function sendAndLog(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  conversation: BotConversation,
  message: Omit<BotOutgoingMessage, "chatId"> & { chatId?: number | string },
  chatId: number | string,
) {
  const identity = await resolveBotBrandIdentity(supabase, conversation.organization_id, conversation.role_key);
  const brandedMessage = { ...message, text: applyBrandIdentity(message.text, identity) };
  const queued = await supabase
    .from("bot_messages")
    .insert({
      channel: adapter.channel,
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      profile_id: conversation.profile_id,
      incident_id: conversation.incident_id,
      direction: "outgoing",
      message_type: "text",
      body: brandedMessage.text,
      status: "queued",
    })
    .select("id")
    .single();
  if (queued.error) throw queued.error;

  try {
    const sent = await adapter.sendMessage({ ...brandedMessage, chatId: message.chatId ?? chatId });
    await supabase
      .from("bot_messages")
      .update({ status: "sent", ...externalIdColumns(sent.externalMessageId) })
      .eq("id", queued.data.id);
  } catch (error) {
    await Promise.all([
      supabase.from("bot_messages").update({ status: "failed" }).eq("id", queued.data.id),
      supabase.from("bot_errors").insert({
        organization_id: conversation.organization_id,
        conversation_id: conversation.id,
        message_id: queued.data.id,
        profile_id: conversation.profile_id,
        error_code: `${adapter.channel.toUpperCase()}_SEND_FAILED`,
        safe_message: `Le message ${channelLabel(adapter.channel)} n a pas pu etre envoye.`,
        internal_details: { message: safeError(error) },
      }),
    ]);
    throw error;
  }
}

async function updateConversation(
  supabase: AdminClient,
  conversation: BotConversation,
  values: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("bot_conversations")
    .update({ ...values, last_activity_at: nowIso() })
    .eq("id", conversation.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as BotConversation;
}

async function findAccount(supabase: AdminClient, telegramUserId: number) {
  const { data, error } = await supabase
    .from("telegram_accounts")
    .select("id,organization_id,profile_id,telegram_user_id,telegram_chat_id,status")
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "connected")
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as TelegramAccount | null;
}

function toBotAccount(account: TelegramAccount, replyTarget: number): BotAccount {
  return {
    id: account.id,
    channel: "telegram",
    organization_id: account.organization_id,
    profile_id: account.profile_id,
    replyTarget,
  };
}

/** Normalise un message Telegram vers la forme neutre partagée avec WhatsApp. */
function toIncomingMessage(message: TelegramMessage, updateId: number): BotIncomingMessage {
  const photo = message.photo?.[message.photo.length - 1];
  const document = message.document;
  const file = photo ?? document;
  return {
    externalMessageId: message.message_id,
    text: message.text ?? null,
    caption: message.caption ?? null,
    attachment: file
      ? {
          kind: photo ? "photo" : "document",
          fileId: file.file_id,
          fileUniqueId: file.file_unique_id,
          fileName: document?.file_name ?? null,
          mimeType: document?.mime_type ?? (photo ? "image/jpeg" : null),
          fileSize: file.file_size ?? null,
        }
      : null,
    metadata: { update_id: updateId },
  };
}

export async function findRole(supabase: AdminClient, account: Pick<BotAccount, "organization_id" | "profile_id">) {
  const { data } = await supabase
    .from("organization_members")
    .select("member_type,member_role_assignments(roles(key))")
    .eq("organization_id", account.organization_id)
    .eq("profile_id", account.profile_id)
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  const assignments = data?.member_role_assignments as Array<{ roles?: { key?: string } | null }> | undefined;
  return assignments?.[0]?.roles?.key ?? (data?.member_type as string | undefined) ?? "inconnu";
}

export async function getConversation(supabase: AdminClient, account: BotAccount, roleKey: string) {
  const current = await supabase
    .from("bot_conversations")
    .select("*")
    .eq(accountColumn(account.channel), account.id)
    .in("status", ["active", "waiting_user", "waiting_system"])
    .is("archived_at", null)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (current.error) throw current.error;
  if (current.data) return current.data as BotConversation;

  const created = await supabase
    .from("bot_conversations")
    .insert({
      channel: account.channel,
      organization_id: account.organization_id,
      profile_id: account.profile_id,
      [accountColumn(account.channel)]: account.id,
      role_key: roleKey,
    })
    .select("*")
    .single();
  if (created.error) throw created.error;
  return created.data as BotConversation;
}

// roleMenu vit desormais dans services/bot/menus.ts (logique pure, donc testable) et reste
// re-exporte ici pour les appelants existants.
export { roleMenu };

async function confirmLink(supabase: AdminClient, token: string, user: TelegramUser, chatId: number) {
  const invitation = await supabase
    .from("telegram_link_invitations")
    .select("*")
    .eq("token_hash", hash(token))
    .eq("status", "pending")
    .is("archived_at", null)
    .maybeSingle();
  if (invitation.error) throw invitation.error;
  if (!invitation.data) throw new Error("Invitation inconnue ou deja utilisee.");
  if (new Date(invitation.data.expires_at).getTime() <= Date.now()) {
    await supabase.from("telegram_link_invitations").update({ status: "expired" }).eq("id", invitation.data.id);
    throw new Error("Invitation expiree.");
  }

  const member = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", invitation.data.organization_id)
    .eq("profile_id", invitation.data.profile_id)
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (member.error || !member.data) throw new Error("Compte GERIMMO inactif ou non autorise.");

  const existing = await findAccount(supabase, user.id);
  if (existing && existing.profile_id !== invitation.data.profile_id) {
    throw new Error("Ce compte Telegram est deja lie a un autre profil.");
  }

  const account = existing
    ? await supabase
        .from("telegram_accounts")
        .update({
          telegram_chat_id: chatId,
          telegram_username: user.username,
          telegram_display_name: [user.first_name, user.last_name].filter(Boolean).join(" "),
          last_activity_at: nowIso(),
        })
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabase
        .from("telegram_accounts")
        .insert({
          organization_id: invitation.data.organization_id,
          profile_id: invitation.data.profile_id,
          invitation_id: invitation.data.id,
          telegram_user_id: user.id,
          telegram_chat_id: chatId,
          telegram_username: user.username,
          telegram_display_name: [user.first_name, user.last_name].filter(Boolean).join(" "),
          last_activity_at: nowIso(),
        })
        .select("*")
        .single();
  if (account.error) throw account.error;

  await supabase
    .from("telegram_link_invitations")
    .update({ status: "confirmed", confirmed_at: nowIso() })
    .eq("id", invitation.data.id);
  return account.data as TelegramAccount;
}

async function listHomes(supabase: AdminClient, account: Pick<BotAccount, "organization_id" | "profile_id">) {
  const { data, error } = await supabase
    .from("bien_occupants")
    .select("bien_id,biens(id,name,reference,address_line1,city,organization_id)")
    .eq("profile_id", account.profile_id)
    .eq("organization_id", account.organization_id)
    .is("archived_at", null)
    .is("ended_at", null);
  if (error) throw error;
  return (data ?? []).flatMap((item) => item.biens ?? []).filter(Boolean) as Array<{
    id: string;
    name: string;
    reference: string;
    address_line1: string | null;
    city: string | null;
  }>;
}

type OwnerBien = {
  id: string;
  name: string;
  reference: string;
  city: string | null;
  monthly_rent_cents: number | null;
};

/** Biens détenus par un propriétaire (occupant_type = 'proprietaire'). */
async function listOwnerBiens(
  supabase: AdminClient,
  account: Pick<BotAccount, "organization_id" | "profile_id">,
): Promise<OwnerBien[]> {
  const { data, error } = await supabase
    .from("bien_occupants")
    .select("biens(id,name,reference,city,monthly_rent_cents)")
    .eq("profile_id", account.profile_id)
    .eq("organization_id", account.organization_id)
    .eq("occupant_type", "proprietaire")
    .is("archived_at", null)
    .is("ended_at", null);
  if (error) throw error;
  return (data ?? []).flatMap((item) => item.biens ?? []).filter(Boolean) as OwnerBien[];
}

function euros(cents: number | null | undefined) {
  return `${((cents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

async function showOwnerBiens(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const biens = await listOwnerBiens(supabase, account);
  const lines = biens.map(
    (bien) =>
      `${bien.reference} - ${bien.name}${bien.city ? ` (${bien.city})` : ""} - loyer ${euros(bien.monthly_rent_cents)}`,
  );
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    { text: lines.length ? `Vos biens :\n${lines.join("\n")}` : "Aucun bien n est rattache a votre profil." },
    chatId,
  );
}

/**
 * Incidents de toute l'organisation, pour les rôles de back-office.
 *
 * Ne PAS réutiliser showOwnerIncidents ici : celui-ci part de listOwnerBiens, qui filtre sur
 * `bien_occupants.occupant_type = 'proprietaire'`. Un administrateur d'agence n'est occupant
 * d'aucun bien : il aurait obtenu « Aucun incident sur vos biens », ce qui est faux.
 */
async function showAgencyIncidents(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const incidents = await supabase
    .from("incidents")
    .select("number,status,updated_at,biens(reference)")
    .eq("organization_id", account.organization_id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(15);
  if (incidents.error) throw incidents.error;

  const lignes = ((incidents.data ?? []) as Array<Record<string, unknown>>).map((incident) => {
    const bien = incident.biens as { reference?: string | null } | null;
    return `${incident.number} - ${bien?.reference ?? "bien"} - ${incident.status}`;
  });

  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: lignes.length ? `Incidents de l agence :\n${lignes.join("\n")}` : "Aucun incident en cours dans l agence.",
    },
    chatId,
  );
}

async function showOwnerIncidents(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const biens = await listOwnerBiens(supabase, account);
  const bienIds = biens.map((bien) => bien.id);
  const incidents = bienIds.length
    ? await supabase
        .from("incidents")
        .select("number,status,updated_at,bien_id")
        .in("bien_id", bienIds)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(15)
    : { data: [], error: null };
  if (incidents.error) throw incidents.error;
  const byBien = new Map(biens.map((bien) => [bien.id, bien.reference]));
  const lines = (incidents.data ?? []).map(
    (incident) => `${incident.number} - ${byBien.get(incident.bien_id) ?? "bien"} - ${incident.status}`,
  );
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    { text: lines.length ? `Incidents de vos biens :\n${lines.join("\n")}` : "Aucun incident sur vos biens." },
    chatId,
  );
}

async function showOwnerEcheances(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const biens = await listOwnerBiens(supabase, account);
  const bienIds = biens.map((bien) => bien.id);
  const echeances = bienIds.length
    ? await supabase
        .from("bien_echeances")
        .select("title,due_date,status,amount_cents,bien_id")
        .in("bien_id", bienIds)
        .in("status", ["a_prevoir", "en_cours"])
        .is("archived_at", null)
        .order("due_date", { ascending: true })
        .limit(15)
    : { data: [], error: null };
  if (echeances.error) throw echeances.error;
  const byBien = new Map(biens.map((bien) => [bien.id, bien.reference]));
  const lines = (echeances.data ?? []).map(
    (echeance) =>
      `${echeance.due_date} - ${byBien.get(echeance.bien_id) ?? "bien"} - ${echeance.title}${echeance.amount_cents ? ` (${euros(echeance.amount_cents)})` : ""}`,
  );
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    { text: lines.length ? `Vos echeances a venir :\n${lines.join("\n")}` : "Aucune echeance a venir." },
    chatId,
  );
}

async function showIncidentSummary(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  conversation: BotConversation,
  chatId: number | string,
) {
  const context = conversation.context;
  const attachments = await supabase
    .from("bot_attachments")
    .select("id")
    .eq("conversation_id", conversation.id)
    .is("incident_id", null)
    .eq("status", "stored");
  const summary = [
    "Resume de votre declaration :",
    `- Logement : ${String(context.bienLabel ?? "selectionne")}`,
    `- Categorie probable : ${String(context.categorySlug ?? "a confirmer")}`,
    `- Description : ${String(context.description ?? "")}`,
    `- Photos : ${attachments.data?.length ?? 0}`,
    "Confirmez-vous la creation de cet incident ?",
  ].join("\n");
  const updated = await updateConversation(supabase, conversation, {
    state: "incident_confirmation",
    status: "waiting_user",
  });
  await sendAndLog(
    supabase,
    adapter,
    updated,
    {
      text: summary,
      buttons: [
        [{ text: "Confirmer", callbackData: "incident_confirm" }],
        [{ text: "Annuler", callbackData: "conversation_cancel" }],
      ],
    },
    chatId,
  );
}

async function createIncidentFromConversation(supabase: AdminClient, conversation: BotConversation) {
  const context = conversation.context;
  const category = context.categorySlug
    ? await supabase
        .from("incident_categories")
        .select("id")
        .eq("slug", context.categorySlug)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (category.error) throw category.error;
  const incident = await supabase
    .from("incidents")
    .insert({
      organization_id: conversation.organization_id,
      bien_id: conversation.bien_id,
      created_by: conversation.profile_id,
      category_id: category.data?.id ?? null,
      category: String(context.categorySlug ?? "autre"),
      description: String(context.description ?? "Incident declare depuis la messagerie"),
      priority: "normale",
      status: "nouveau",
      photos: [],
      future_links: { devis: [], interventions: [], rapports: [], bot: conversation.id },
    })
    .select("id,number,status")
    .single();
  if (incident.error) throw incident.error;

  const attachments = await supabase
    .from("bot_attachments")
    .select("id,storage_bucket,storage_path,mime_type,file_name")
    .eq("conversation_id", conversation.id)
    .is("incident_id", null)
    .eq("status", "stored");
  await Promise.all([
    supabase
      .from("bot_attachments")
      .update({ incident_id: incident.data.id })
      .eq("conversation_id", conversation.id)
      .is("incident_id", null),
    supabase
      .from("incidents")
      .update({ photos: attachments.data ?? [] })
      .eq("id", incident.data.id),
    supabase.from("bot_actions").insert({
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      profile_id: conversation.profile_id,
      incident_id: incident.data.id,
      action_type: "INCIDENT_CREATED",
      target_table: "incidents",
      target_id: incident.data.id,
      status: "completed",
      result: { number: incident.data.number },
      processed_at: nowIso(),
    }),
  ]);
  return incident.data as { id: string; number: string; status: string };
}

async function storeAttachment(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  conversation: BotConversation,
  incoming: BotIncomingMessage,
  messageId: string,
) {
  const attachment = incoming.attachment;
  if (!attachment) return null;
  const declaredSize = attachment.fileSize ?? 0;
  const declaredMime = attachment.mimeType;
  const duplicate = await supabase
    .from("bot_attachments")
    .select("id")
    .eq("telegram_file_unique_id", attachment.fileUniqueId)
    .eq("conversation_id", conversation.id)
    .in("status", ["pending", "stored"])
    .is("archived_at", null)
    .maybeSingle();
  if (duplicate.data) return { duplicate: true };
  if (
    declaredSize > maximumAttachmentBytes ||
    (declaredMime !== null && !allowedAttachmentMimeTypes.has(declaredMime))
  ) {
    await supabase.from("bot_attachments").insert({
      channel: adapter.channel,
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      message_id: messageId,
      profile_id: conversation.profile_id,
      telegram_file_id: attachment.fileId,
      telegram_file_unique_id: attachment.fileUniqueId,
      caption: incoming.caption,
      file_name: attachment.fileName,
      mime_type: declaredMime,
      file_size_bytes: Math.min(declaredSize, maximumAttachmentBytes),
      status: "invalid",
      error_code: declaredSize > maximumAttachmentBytes ? "FILE_TOO_LARGE" : "MIME_NOT_ALLOWED",
    });
    throw new Error("Fichier invalide. Formats autorises : JPG, PNG, WEBP et PDF, 10 Mo maximum.");
  }

  const created = await supabase
    .from("bot_attachments")
    .insert({
      channel: adapter.channel,
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      message_id: messageId,
      profile_id: conversation.profile_id,
      telegram_file_id: attachment.fileId,
      telegram_file_unique_id: attachment.fileUniqueId,
      caption: incoming.caption,
      file_name: attachment.fileName,
      mime_type: declaredMime,
      file_size_bytes: declaredSize,
    })
    .select("id")
    .single();
  if (created.error) throw created.error;

  try {
    const downloaded = await adapter.downloadFile(attachment.fileId);
    const downloadedMimeType = allowedAttachmentMimeTypes.has(downloaded.mimeType) ? downloaded.mimeType : declaredMime;
    if (
      !downloadedMimeType ||
      downloaded.bytes.byteLength > maximumAttachmentBytes ||
      !allowedAttachmentMimeTypes.has(downloadedMimeType)
    ) {
      throw new Error("Fichier invalide.");
    }
    const extension = downloaded.filePath.split(".").pop() ?? "bin";
    const storagePath = `${conversation.organization_id}/${conversation.profile_id}/${conversation.id}/${created.data.id}.${extension}`;
    const upload = await supabase.storage.from("incident-attachments").upload(storagePath, downloaded.bytes, {
      contentType: downloadedMimeType,
      upsert: false,
    });
    if (upload.error) throw upload.error;
    await supabase
      .from("bot_attachments")
      .update({
        storage_path: storagePath,
        mime_type: downloadedMimeType,
        file_size_bytes: downloaded.bytes.byteLength,
        checksum: hash(Buffer.from(downloaded.bytes).toString("base64")),
        status: "stored",
      })
      .eq("id", created.data.id);
    return { duplicate: false };
  } catch (error) {
    await supabase
      .from("bot_attachments")
      .update({ status: "failed", error_code: "STORAGE_FAILED" })
      .eq("id", created.data.id);
    throw error;
  }
}

async function showFollowUp(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const homes = await listHomes(supabase, account);
  const homeIds = homes.map((home) => home.id);
  const incidents = homeIds.length
    ? await supabase
        .from("incidents")
        .select("id,number,status,updated_at,responsible_profile_id")
        .in("bien_id", homeIds)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(10)
    : { data: [], error: null };
  if (incidents.error) throw incidents.error;
  const lines = (incidents.data ?? []).map(
    (incident) => `${incident.number} - ${incident.status} - prochaine etape : traitement par le responsable`,
  );
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: lines.length
        ? `Vos incidents ouverts :\n${lines.join("\n")}`
        : "Aucun incident ouvert n est rattache a vos logements.",
    },
    chatId,
  );
}

async function showDocuments(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const documents = await supabase
    .from("documents")
    .select("id,title,document_type,status")
    .eq("organization_id", account.organization_id)
    .eq("tenant_profile_id", account.profile_id)
    .eq("visibility", "locataire")
    .eq("status", "actif")
    .is("archived_at", null)
    .limit(10);
  if (documents.error) throw documents.error;
  const allowed = (documents.data ?? []).filter((document) => allowedTenantDocumentTypes.has(document.document_type));
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: allowed.length ? "Documents autorises disponibles :" : "Aucun document autorise n est disponible.",
      buttons: allowed.map((document) => [{ text: document.title, callbackData: `document:${document.id}` }]),
    },
    chatId,
  );
}

async function prepareDocumentEmail(supabase: AdminClient, conversation: BotConversation, documentId: string) {
  const document = await supabase
    .from("documents")
    .select("id,organization_id,title,document_type,tenant_profile_id,visibility,status")
    .eq("id", documentId)
    .eq("organization_id", conversation.organization_id)
    .eq("tenant_profile_id", conversation.profile_id)
    .eq("visibility", "locataire")
    .eq("status", "actif")
    .is("archived_at", null)
    .maybeSingle();
  if (document.error || !document.data || !allowedTenantDocumentTypes.has(document.data.document_type)) {
    throw new Error("Document non autorise.");
  }
  const profile = await supabase.from("profiles").select("email").eq("id", conversation.profile_id).single();
  if (profile.error || !profile.data.email) throw new Error("Adresse e-mail indisponible.");
  const identity = await resolveBotBrandIdentity(supabase, conversation.organization_id, conversation.role_key);
  const outbox = await supabase
    .from("document_email_outbox")
    .insert({
      organization_id: conversation.organization_id,
      document_id: documentId,
      recipient_email: profile.data.email,
      subject: `Votre document ${identity.displayName} - ${document.data.title}`,
      body: `Envoi prepare depuis l assistance ${identity.displayName}.`,
      status: "pret",
    })
    .select("id")
    .single();
  if (outbox.error) throw outbox.error;
  await supabase.from("bot_document_requests").insert({
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    profile_id: conversation.profile_id,
    document_id: documentId,
    email_outbox_id: outbox.data.id,
    status: "prepared",
    confirmed_at: nowIso(),
    prepared_at: nowIso(),
  });
  return document.data.title as string;
}

async function showSchedules(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const requests = await supabase
    .from("incident_schedule_requests")
    .select("id,status,current_round,incidents(number)")
    .eq("organization_id", account.organization_id)
    .eq("artisan_profile_id", account.profile_id)
    .in("status", ["demande_disponibilites", "relance_artisan"])
    .is("archived_at", null)
    .limit(10);
  if (requests.error) throw requests.error;
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: requests.data?.length
        ? "Selectionnez une demande puis envoyez au moins 3 lignes au format AAAA-MM-JJ HH:MM-HH:MM."
        : "Aucune demande de disponibilites en attente.",
      buttons: (requests.data ?? []).map((request) => [
        {
          text: `${request.incidents?.[0]?.number ?? "Incident"} - tour ${request.current_round}`,
          callbackData: `schedule:${request.id}`,
        },
      ]),
    },
    chatId,
  );
}

async function saveScheduleSlots(
  supabase: AdminClient,
  conversation: BotConversation,
  scheduleId: string,
  text: string,
) {
  const slots = parseAvailabilitySlots(text);
  if (slots.length < 3) throw new Error("Proposez au minimum 3 creneaux valides au format AAAA-MM-JJ HH:MM-HH:MM.");
  const schedule = await supabase
    .from("incident_schedule_requests")
    .select("id,organization_id,current_round,artisan_profile_id")
    .eq("id", scheduleId)
    .eq("organization_id", conversation.organization_id)
    .eq("artisan_profile_id", conversation.profile_id)
    .in("status", ["demande_disponibilites", "relance_artisan"])
    .single();
  if (schedule.error) throw new Error("Demande de disponibilites non autorisee.");
  const batch = await supabase
    .from("incident_schedule_slot_batches")
    .insert({
      organization_id: conversation.organization_id,
      schedule_request_id: scheduleId,
      proposed_by: conversation.profile_id,
      round_number: schedule.data.current_round,
      status: "brouillon",
    })
    .select("id")
    .single();
  if (batch.error) throw batch.error;
  const inserted = await supabase.from("incident_schedule_slots").insert(
    slots.map((slot) => ({
      organization_id: conversation.organization_id,
      schedule_request_id: scheduleId,
      batch_id: batch.data.id,
      slot_date: slot.starts_at.slice(0, 10),
      ...slot,
    })),
  );
  if (inserted.error) throw inserted.error;
  const [batchUpdate, scheduleUpdate] = await Promise.all([
    supabase
      .from("incident_schedule_slot_batches")
      .update({ status: "proposee", sent_at: nowIso() })
      .eq("id", batch.data.id),
    supabase.from("incident_schedule_requests").update({ status: "creneaux_proposes" }).eq("id", scheduleId),
  ]);
  if (batchUpdate.error || scheduleUpdate.error) throw batchUpdate.error ?? scheduleUpdate.error;
  return slots;
}

function slotLabel(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const from = start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const to = end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${from}-${to}`;
}

/** Demandes de créneaux transmises au locataire, en attente de son choix. */
async function showTenantSchedules(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const requests = await supabase
    .from("incident_schedule_requests")
    .select("id,current_round,incidents(number)")
    .eq("organization_id", account.organization_id)
    .eq("tenant_profile_id", account.profile_id)
    .eq("status", "transmis_locataire")
    .is("archived_at", null)
    .limit(10);
  if (requests.error) throw requests.error;
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: requests.data?.length
        ? "Selectionnez le rendez-vous pour lequel choisir un creneau :"
        : "Aucun rendez-vous en attente de votre choix.",
      buttons: (requests.data ?? []).map((request) => [
        {
          text: `${request.incidents?.[0]?.number ?? "Incident"}`,
          callbackData: `tschedule:${request.id}`,
        },
      ]),
    },
    chatId,
  );
}

/** Créneaux proposés (dernier lot transmis) pour une demande, à présenter au locataire. */
async function showTenantSlots(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  scheduleRequestId: string,
  chatId: number | string,
) {
  const request = await supabase
    .from("incident_schedule_requests")
    .select("id,tenant_profile_id,status")
    .eq("id", scheduleRequestId)
    .eq("tenant_profile_id", account.profile_id)
    .eq("status", "transmis_locataire")
    .is("archived_at", null)
    .maybeSingle();
  if (request.error) throw request.error;
  if (!request.data) throw new Error("Rendez-vous non autorise ou deja traite.");

  const slots = await supabase
    .from("incident_schedule_slots")
    .select("id,starts_at,ends_at")
    .eq("schedule_request_id", scheduleRequestId)
    .eq("status", "propose")
    .is("archived_at", null)
    .order("starts_at", { ascending: true })
    .limit(10);
  if (slots.error) throw slots.error;
  if (!slots.data?.length) throw new Error("Aucun creneau disponible pour ce rendez-vous.");

  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: "Choisissez le creneau qui vous convient :",
      buttons: slots.data.map((slot) => [
        { text: slotLabel(slot.starts_at, slot.ends_at), callbackData: `tslot:${scheduleRequestId}:${slot.id}` },
      ]),
    },
    chatId,
  );
}

/**
 * Choix d'un créneau par le locataire (équivalent decideSchedule action 'choix_locataire',
 * exécuté en service role : on vérifie donc explicitement l'appartenance de la demande).
 */
async function validateTenantSlot(
  supabase: AdminClient,
  account: BotAccount,
  scheduleRequestId: string,
  slotId: string,
) {
  const request = await supabase
    .from("incident_schedule_requests")
    .select("id,organization_id,tenant_profile_id,status")
    .eq("id", scheduleRequestId)
    .eq("tenant_profile_id", account.profile_id)
    .eq("status", "transmis_locataire")
    .is("archived_at", null)
    .maybeSingle();
  if (request.error) throw request.error;
  if (!request.data) throw new Error("Rendez-vous non autorise ou deja traite.");

  const slot = await supabase
    .from("incident_schedule_slots")
    .select("id,starts_at,ends_at")
    .eq("id", slotId)
    .eq("schedule_request_id", scheduleRequestId)
    .eq("status", "propose")
    .maybeSingle();
  if (slot.error) throw slot.error;
  if (!slot.data) throw new Error("Creneau invalide.");

  const latestBatch = await supabase
    .from("incident_schedule_slot_batches")
    .select("id")
    .eq("schedule_request_id", scheduleRequestId)
    .is("archived_at", null)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestBatch.error) throw latestBatch.error;

  const response = await supabase.from("incident_schedule_responses").insert({
    organization_id: request.data.organization_id,
    schedule_request_id: scheduleRequestId,
    batch_id: latestBatch.data?.id ?? null,
    slot_id: slotId,
    actor_profile_id: account.profile_id,
    actor_role: "locataire",
    action: "choix_locataire",
  });
  if (response.error) throw response.error;

  const [requestUpdate, selectedSlot, otherSlots, batchUpdate] = await Promise.all([
    supabase
      .from("incident_schedule_requests")
      .update({ status: "valide", selected_slot_id: slotId, validated_at: nowIso() })
      .eq("id", scheduleRequestId),
    supabase.from("incident_schedule_slots").update({ status: "selectionne" }).eq("id", slotId),
    supabase
      .from("incident_schedule_slots")
      .update({ status: "refuse" })
      .eq("schedule_request_id", scheduleRequestId)
      .neq("id", slotId),
    latestBatch.data
      ? supabase.from("incident_schedule_slot_batches").update({ status: "acceptee" }).eq("id", latestBatch.data.id)
      : Promise.resolve({ error: null }),
  ]);
  for (const result of [requestUpdate, selectedSlot, otherSlots, batchUpdate]) {
    if (result.error) throw result.error;
  }
  return slotLabel(slot.data.starts_at, slot.data.ends_at);
}

const interventionStatusLabel: Record<string, string> = {
  planifiee: "Planifiee",
  confirmee: "Confirmee",
  en_cours: "En cours",
  suspendue: "Suspendue",
};

// Prochaine action possible par l'artisan selon le statut courant.
const interventionNextAction: Record<string, { action: string; label: string } | undefined> = {
  planifiee: { action: "confirmer", label: "Confirmer l intervention" },
  confirmee: { action: "demarrer", label: "Demarrer l intervention" },
  en_cours: { action: "terminer", label: "Terminer l intervention" },
};

/** Interventions actives attribuées à l'artisan. */
async function showArtisanInterventions(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const interventions = await supabase
    .from("incident_interventions")
    .select("id,status,planned_starts_at,incidents(number)")
    .eq("organization_id", account.organization_id)
    .eq("artisan_profile_id", account.profile_id)
    .in("status", ["planifiee", "confirmee", "en_cours", "suspendue"])
    .is("archived_at", null)
    .order("planned_starts_at", { ascending: true })
    .limit(10);
  if (interventions.error) throw interventions.error;
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: interventions.data?.length
        ? "Vos interventions en cours :"
        : "Aucune intervention ne vous est attribuee actuellement.",
      buttons: (interventions.data ?? []).map((intervention) => {
        const date = new Date(intervention.planned_starts_at).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        });
        return [
          {
            text: `${intervention.incidents?.[0]?.number ?? "Incident"} - ${date} - ${interventionStatusLabel[intervention.status] ?? intervention.status}`,
            callbackData: `intervention:${intervention.id}`,
          },
        ];
      }),
    },
    chatId,
  );
}

/** Détail d'une intervention + prochaine action possible. */
async function showInterventionActions(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  interventionId: string,
  chatId: number | string,
) {
  const intervention = await supabase
    .from("incident_interventions")
    .select("id,status,planned_starts_at,planned_ends_at,work_description,incidents(number)")
    .eq("id", interventionId)
    .eq("artisan_profile_id", account.profile_id)
    .is("archived_at", null)
    .maybeSingle();
  if (intervention.error) throw intervention.error;
  if (!intervention.data) throw new Error("Intervention non autorisee.");

  const next = interventionNextAction[intervention.data.status];
  const summary = [
    `Incident ${intervention.data.incidents?.[0]?.number ?? ""}`.trim(),
    `Statut : ${interventionStatusLabel[intervention.data.status] ?? intervention.data.status}`,
    `Prevu : ${slotLabel(intervention.data.planned_starts_at, intervention.data.planned_ends_at)}`,
    intervention.data.work_description ? `Travaux : ${intervention.data.work_description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: next ? summary : `${summary}\n\nAucune action disponible pour le moment.`,
      buttons: next ? [[{ text: next.label, callbackData: `intervact:${interventionId}:${next.action}` }]] : undefined,
    },
    chatId,
  );
}

/** Applique une transition d'intervention par l'artisan (service role → contrôle de propriété). */
async function transitionArtisanIntervention(
  supabase: AdminClient,
  account: BotAccount,
  interventionId: string,
  action: string,
) {
  const intervention = await supabase
    .from("incident_interventions")
    .select("id,status")
    .eq("id", interventionId)
    .eq("artisan_profile_id", account.profile_id)
    .is("archived_at", null)
    .maybeSingle();
  if (intervention.error) throw intervention.error;
  if (!intervention.data) throw new Error("Intervention non autorisee.");

  const expected = interventionNextAction[intervention.data.status];
  if (!expected || expected.action !== action) throw new Error("Action non disponible pour cette intervention.");

  const values: Record<string, unknown> =
    action === "confirmer"
      ? { status: "confirmee" }
      : action === "demarrer"
        ? { status: "en_cours", actual_starts_at: nowIso() }
        : { status: "terminee", actual_ends_at: nowIso() };
  const { error } = await supabase.from("incident_interventions").update(values).eq("id", interventionId);
  if (error) throw error;
  return action;
}

/** Demandes de devis en attente pour lesquelles l'artisan est destinataire. */
async function showArtisanQuoteRequests(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  chatId: number | string,
) {
  const recipients = await supabase
    .from("incident_quote_recipients")
    .select("id,quote_request_id,incident_quote_requests(incidents(number))")
    .eq("organization_id", account.organization_id)
    .eq("artisan_profile_id", account.profile_id)
    .eq("status", "demande")
    .is("archived_at", null)
    .limit(10);
  if (recipients.error) throw recipients.error;
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: recipients.data?.length
        ? "Demandes de devis en attente. Selectionnez-en une pour repondre :"
        : "Aucune demande de devis en attente.",
      buttons: (recipients.data ?? []).map((recipient) => {
        const number = recipient.incident_quote_requests?.[0]?.incidents?.[0]?.number ?? "Incident";
        return [{ text: `Devis ${number}`, callbackData: `quote:${recipient.id}` }];
      }),
    },
    chatId,
  );
}

/** Prépare la saisie du montant du devis (le montant arrive au message suivant). */
async function startQuoteAnswer(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  conversation: BotConversation,
  recipientId: string,
  chatId: number | string,
) {
  const recipient = await supabase
    .from("incident_quote_recipients")
    .select("id,quote_request_id")
    .eq("id", recipientId)
    .eq("artisan_profile_id", account.profile_id)
    .eq("status", "demande")
    .is("archived_at", null)
    .maybeSingle();
  if (recipient.error) throw recipient.error;
  if (!recipient.data) throw new Error("Demande de devis non autorisee ou deja traitee.");

  const updated = await updateConversation(supabase, conversation, {
    state: "quote_amount",
    status: "waiting_user",
    context: { quoteRecipientId: recipientId, quoteRequestId: recipient.data.quote_request_id },
  });
  await sendAndLog(
    supabase,
    adapter,
    updated,
    { text: "Envoyez le montant TTC de votre devis en euros (par exemple 250 ou 250,50)." },
    chatId,
  );
}

/** Enregistre le devis de l'artisan (insert incident_quotes + destinataire passé à 'recu'). */
async function submitArtisanQuote(
  supabase: AdminClient,
  account: BotAccount,
  recipientId: string,
  quoteRequestId: string,
  amountCents: number,
) {
  const recipient = await supabase
    .from("incident_quote_recipients")
    .select("id,organization_id,quote_request_id")
    .eq("id", recipientId)
    .eq("quote_request_id", quoteRequestId)
    .eq("artisan_profile_id", account.profile_id)
    .eq("status", "demande")
    .is("archived_at", null)
    .maybeSingle();
  if (recipient.error) throw recipient.error;
  if (!recipient.data) throw new Error("Demande de devis non autorisee ou deja traitee.");

  const quote = await supabase.from("incident_quotes").insert({
    organization_id: recipient.data.organization_id,
    quote_request_id: quoteRequestId,
    recipient_id: recipientId,
    amount_cents: amountCents,
    currency: "EUR",
    status: "recu",
  });
  if (quote.error) throw quote.error;

  const recipientUpdate = await supabase
    .from("incident_quote_recipients")
    .update({ status: "recu", responded_at: nowIso() })
    .eq("id", recipientId);
  if (recipientUpdate.error) throw recipientUpdate.error;
}

export async function processConnectedMessage(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  incoming: BotIncomingMessage,
  webhookId: string,
  skipIncomingLog = false,
) {
  const role = await findRole(supabase, account);
  let conversation = await getConversation(supabase, account, role);
  const replyTarget = account.replyTarget;
  const recent = await supabase
    .from("bot_messages")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", account.profile_id)
    .eq("direction", "incoming")
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((recent.count ?? 0) >= 20) {
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: "Trop de messages ont ete recus. Reessayez dans une minute." },
      replyTarget,
    );
    return;
  }

  const messageType = incoming.attachment ? incoming.attachment.kind : "text";

  let incomingMessageId: string | null = null;
  if (!skipIncomingLog) {
    const logged = await supabase
      .from("bot_messages")
      .insert({
        channel: adapter.channel,
        organization_id: account.organization_id,
        conversation_id: conversation.id,
        profile_id: account.profile_id,
        webhook_update_id: webhookId,
        direction: "incoming",
        message_type: messageType,
        ...externalIdColumns(incoming.externalMessageId),
        body: incoming.text ?? incoming.caption,
        status: "received",
        metadata: incoming.metadata ?? {},
      })
      .select("id")
      .single();
    if (logged.error) throw logged.error;
    incomingMessageId = logged.data.id;
  }

  const text = (incoming.text ?? incoming.caption ?? "").trim();
  if (incoming.attachment) {
    if (!conversation.state.startsWith("incident_"))
      throw new Error("Aucun incident en cours de declaration pour ce fichier.");
    if (!incomingMessageId) throw new Error("Message de piece jointe non journalise.");
    await storeAttachment(supabase, adapter, conversation, incoming, incomingMessageId);
    await showIncidentSummary(supabase, adapter, conversation, replyTarget);
    return;
  }

  const command = text.toLowerCase();
  if (command === "/start" || command === "/menu" || command === "menu") {
    conversation = await updateConversation(supabase, conversation, {
      state: "idle",
      status: "active",
      question_count: 0,
      context: {},
    });
    await sendAndLog(supabase, adapter, conversation, roleMenu(role), replyTarget);
    return;
  }

  if (conversation.state === "incident_description") {
    const classification = classifyMessage(text);
    const homes = await listHomes(supabase, account);
    if (homes.length === 0) throw new Error("Aucun logement autorise n est rattache a votre profil.");
    const context = { description: text, categorySlug: classification.categorySlug };
    if (homes.length > 1) {
      conversation = await updateConversation(supabase, conversation, {
        state: "incident_bien",
        context,
        question_count: 1,
        status: "waiting_user",
      });
      await sendAndLog(
        supabase,
        adapter,
        conversation,
        {
          text: "Quel logement est concerne ?",
          buttons: homes.map((home) => [{ text: `${home.reference} - ${home.name}`, callbackData: `home:${home.id}` }]),
        },
        replyTarget,
      );
      return;
    }
    const home = homes[0];
    if (classification.needsClarification) {
      conversation = await updateConversation(supabase, conversation, {
        bien_id: home.id,
        state: "incident_clarification",
        context: { ...context, bienLabel: `${home.reference} - ${home.name}` },
        question_count: 1,
        status: "waiting_user",
      });
      await sendAndLog(
        supabase,
        adapter,
        conversation,
        { text: "Pouvez-vous preciser l endroit exact et ce qui est endommage ?" },
        replyTarget,
      );
      return;
    }
    conversation = await updateConversation(supabase, conversation, {
      bien_id: home.id,
      state: "incident_photo",
      context: { ...context, bienLabel: `${home.reference} - ${home.name}` },
      question_count: 1,
      status: "waiting_user",
    });
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: "Envoyez une ou plusieurs photos, puis utilisez /sansphoto si vous ne pouvez pas en fournir." },
      replyTarget,
    );
    return;
  }

  if (conversation.state === "incident_clarification") {
    conversation = await updateConversation(supabase, conversation, {
      state: "incident_photo",
      context: {
        ...conversation.context,
        description: `${String(conversation.context.description ?? "")}\nPrecision : ${text}`,
      },
      question_count: Math.min(3, conversation.question_count + 1),
      status: "waiting_user",
    });
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: "Merci. Envoyez une ou plusieurs photos, ou utilisez /sansphoto." },
      replyTarget,
    );
    return;
  }

  if (conversation.state === "incident_photo" && (command === "/sansphoto" || command === "sans photo")) {
    await showIncidentSummary(supabase, adapter, conversation, replyTarget);
    return;
  }

  if (conversation.state === "schedule_slots") {
    const scheduleId = String(conversation.context.scheduleId ?? "");
    const slots = await saveScheduleSlots(supabase, conversation, scheduleId, text);
    conversation = await updateConversation(supabase, conversation, { state: "idle", status: "active", context: {} });
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: `${slots.length} creneaux ont ete enregistres et transmis au responsable.` },
      replyTarget,
    );
    return;
  }

  if (conversation.state === "quote_amount") {
    const amountCents = parseEurosToCents(text);
    if (amountCents === null) {
      await sendAndLog(
        supabase,
        adapter,
        conversation,
        { text: "Montant non compris. Envoyez un nombre en euros, par exemple 250 ou 250,50." },
        replyTarget,
      );
      return;
    }
    const recipientId = String(conversation.context.quoteRecipientId ?? "");
    const quoteRequestId = String(conversation.context.quoteRequestId ?? "");
    await submitArtisanQuote(supabase, account, recipientId, quoteRequestId, amountCents);
    conversation = await updateConversation(supabase, conversation, { state: "idle", status: "active", context: {} });
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: `Votre devis de ${euros(amountCents)} a bien ete transmis au responsable. Merci !` },
      replyTarget,
    );
    return;
  }

  const classification = classifyMessage(text);
  if (classification.intent === "declarer_incident") {
    conversation = await updateConversation(supabase, conversation, {
      state: "incident_description",
      intent: "declarer_incident",
      question_count: 0,
      context: {},
      status: "waiting_user",
    });
    await processConnectedMessage(supabase, adapter, account, { ...incoming, text }, webhookId, true);
    return;
  }
  if (classification.intent === "suivre_incident")
    return showFollowUp(supabase, adapter, account, conversation, replyTarget);
  if (classification.intent === "demander_document")
    return showDocuments(supabase, adapter, account, conversation, replyTarget);
  if (classification.intent === "proposer_disponibilites" && role === "artisan")
    return showSchedules(supabase, adapter, account, conversation, replyTarget);
  await sendAndLog(
    supabase,
    adapter,
    conversation,
    {
      text: "Je n ai pas suffisamment compris. Choisissez une action ou demandez une transmission au responsable.",
      buttons: roleMenu(role).buttons,
    },
    replyTarget,
  );
}

export async function processCallback(
  supabase: AdminClient,
  adapter: BotChannelAdapter,
  account: BotAccount,
  data: string,
  callbackId: string | null,
  webhookId: string,
) {
  if (callbackId) await adapter.answerCallback(callbackId);
  const role = await findRole(supabase, account);
  let conversation = await getConversation(supabase, account, role);
  const chatId = account.replyTarget;

  if (data === "menu_incident") {
    conversation = await updateConversation(supabase, conversation, {
      state: "incident_description",
      intent: "declarer_incident",
      question_count: 0,
      context: {},
      status: "waiting_user",
    });
    await sendAndLog(supabase, adapter, conversation, { text: "Decrivez librement le probleme rencontre." }, chatId);
  } else if (data === "menu_follow") {
    await showFollowUp(supabase, adapter, account, conversation, chatId);
  } else if (data === "menu_documents") {
    await showDocuments(supabase, adapter, account, conversation, chatId);
  } else if (data === "menu_schedule") {
    await showSchedules(supabase, adapter, account, conversation, chatId);
  } else if (data === "menu_owner_biens") {
    await showOwnerBiens(supabase, adapter, account, conversation, chatId);
  } else if (data === "menu_owner_incidents") {
    await showOwnerIncidents(supabase, adapter, account, conversation, chatId);
  } else if (data === "menu_agency_incidents") {
    await showAgencyIncidents(supabase, adapter, account, conversation, chatId);
  } else if (data === "menu_owner_echeances") {
    await showOwnerEcheances(supabase, adapter, account, conversation, chatId);
  } else if (data === "menu_tenant_schedule") {
    await showTenantSchedules(supabase, adapter, account, conversation, chatId);
  } else if (data.startsWith("tschedule:")) {
    await showTenantSlots(supabase, adapter, account, conversation, data.slice(10), chatId);
  } else if (data.startsWith("tslot:")) {
    const [, scheduleRequestId, slotId] = data.split(":");
    const label = await validateTenantSlot(supabase, account, scheduleRequestId, slotId);
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      {
        text: `Votre rendez-vous est confirme pour le creneau ${label}. L artisan et le responsable en sont informes.`,
      },
      chatId,
    );
  } else if (data === "menu_quotes") {
    await showArtisanQuoteRequests(supabase, adapter, account, conversation, chatId);
  } else if (data.startsWith("quote:")) {
    await startQuoteAnswer(supabase, adapter, account, conversation, data.slice(6), chatId);
  } else if (data === "menu_interventions") {
    await showArtisanInterventions(supabase, adapter, account, conversation, chatId);
  } else if (data.startsWith("intervention:")) {
    await showInterventionActions(supabase, adapter, account, conversation, data.slice(13), chatId);
  } else if (data.startsWith("intervact:")) {
    const [, interventionId, action] = data.split(":");
    const applied = await transitionArtisanIntervention(supabase, account, interventionId, action);
    const message =
      applied === "confirmer"
        ? "Intervention confirmee. Le responsable et le locataire en sont informes."
        : applied === "demarrer"
          ? "Intervention demarree. Pensez a la marquer terminee une fois le travail acheve."
          : "Intervention terminee. Merci ! Le responsable va verifier et cloturer le dossier.";
    await sendAndLog(supabase, adapter, conversation, { text: message }, chatId);
  } else if (data === "menu_help") {
    await sendAndLog(supabase, adapter, conversation, roleMenu(role), chatId);
  } else if (data.startsWith("home:")) {
    const bienId = data.slice(5);
    const homes = await listHomes(supabase, account);
    const home = homes.find((item) => item.id === bienId);
    if (!home) throw new Error("Logement non autorise.");
    conversation = await updateConversation(supabase, conversation, {
      bien_id: home.id,
      state: "incident_photo",
      context: { ...conversation.context, bienLabel: `${home.reference} - ${home.name}` },
      question_count: Math.min(3, conversation.question_count + 1),
      status: "waiting_user",
    });
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: "Envoyez une ou plusieurs photos, ou utilisez /sansphoto." },
      chatId,
    );
  } else if (data === "incident_confirm") {
    if (conversation.state !== "incident_confirmation") throw new Error("Aucune declaration a confirmer.");
    const incident = await createIncidentFromConversation(supabase, conversation);
    conversation = await updateConversation(supabase, conversation, {
      incident_id: incident.id,
      state: "idle",
      status: "active",
      context: {},
    });
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      {
        text: `Incident ${incident.number} cree. Un responsable va examiner votre dossier et vous indiquer la prochaine etape.`,
      },
      chatId,
    );
  } else if (data === "conversation_cancel") {
    conversation = await updateConversation(supabase, conversation, {
      state: "idle",
      status: "active",
      question_count: 0,
      context: {},
    });
    await sendAndLog(supabase, adapter, conversation, { text: "Operation annulee." }, chatId);
  } else if (data.startsWith("document:")) {
    const documentId = data.slice(9);
    const document = await supabase
      .from("documents")
      .select("id,title,tenant_profile_id,visibility,status")
      .eq("id", documentId)
      .eq("tenant_profile_id", account.profile_id)
      .eq("visibility", "locataire")
      .eq("status", "actif")
      .maybeSingle();
    if (!document.data) throw new Error("Document non autorise.");
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      {
        text: `Preparer l envoi par e-mail de « ${document.data.title} » ?`,
        buttons: [
          [{ text: "Confirmer", callbackData: `document_confirm:${documentId}` }],
          [{ text: "Annuler", callbackData: "conversation_cancel" }],
        ],
      },
      chatId,
    );
  } else if (data.startsWith("document_confirm:")) {
    const title = await prepareDocumentEmail(supabase, conversation, data.slice(17));
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: `L envoi par e-mail du document « ${title} » a ete prepare.` },
      chatId,
    );
  } else if (data.startsWith("schedule:")) {
    const scheduleId = data.slice(9);
    conversation = await updateConversation(supabase, conversation, {
      state: "schedule_slots",
      status: "waiting_user",
      context: { scheduleId },
    });
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      {
        text: "Envoyez au moins 3 lignes, par exemple :\n2026-08-01 09:00-11:00\n2026-08-02 14:00-16:00\n2026-08-03 10:00-12:00",
      },
      chatId,
    );
  }

  await supabase.from("bot_messages").insert({
    channel: adapter.channel,
    organization_id: account.organization_id,
    conversation_id: conversation.id,
    profile_id: account.profile_id,
    webhook_update_id: webhookId,
    direction: "incoming",
    message_type: "callback",
    body: data,
    status: "processed",
  });
}

export async function processTelegramUpdate(update: TelegramUpdate) {
  const supabase = createAdminClient();
  const adapter = new TelegramAdapter();
  const message = update.message ?? update.callback_query?.message;
  const user = update.message?.from ?? update.callback_query?.from;
  if (!message || !user || message.chat.type !== "private") return { ignored: true };

  const webhook = await supabase
    .from("bot_webhook_updates")
    .insert({
      telegram_update_id: update.update_id,
      telegram_user_id: user.id,
      payload_hash: hash(JSON.stringify(update)),
      status: "processing",
    })
    .select("id")
    .single();
  if (webhook.error?.code === "23505") return { duplicate: true };
  if (webhook.error) throw webhook.error;

  try {
    const startToken = update.message?.text?.match(/^\/start\s+([A-Za-z0-9_-]+)$/)?.[1];
    if (startToken) {
      const pending = await supabase
        .from("telegram_link_invitations")
        .select("id,expires_at")
        .eq("token_hash", hash(startToken))
        .eq("status", "pending")
        .maybeSingle();
      if (!pending.data || new Date(pending.data.expires_at).getTime() <= Date.now())
        throw new Error("Invitation inconnue ou expiree.");
      await adapter.sendMessage({
        chatId: message.chat.id,
        text: "Confirmez-vous la liaison de ce compte Telegram avec votre profil GERIMMO ?",
        buttons: [[{ text: "Confirmer la liaison", callbackData: `link_confirm:${startToken}` }]],
      });
      await supabase
        .from("bot_webhook_updates")
        .update({ status: "processed", processed_at: nowIso() })
        .eq("id", webhook.data.id);
      return { pendingConfirmation: true };
    }

    if (update.callback_query?.data?.startsWith("link_confirm:")) {
      const account = await confirmLink(supabase, update.callback_query.data.slice(13), user, message.chat.id);
      const botAccount = toBotAccount(account, message.chat.id);
      const role = await findRole(supabase, botAccount);
      const conversation = await getConversation(supabase, botAccount, role);
      const identity = await resolveBotBrandIdentity(supabase, account.organization_id, role);
      await adapter.answerCallback(update.callback_query.id, "Compte lie");
      await sendAndLog(
        supabase,
        adapter,
        conversation,
        {
          ...roleMenu(role),
          text: `${identity.welcomeMessage}\n\nVotre compte Telegram est maintenant lie. Que souhaitez-vous faire ?`,
        },
        message.chat.id,
      );
      await supabase
        .from("bot_webhook_updates")
        .update({ organization_id: account.organization_id, status: "processed", processed_at: nowIso() })
        .eq("id", webhook.data.id);
      return { linked: true };
    }

    const account = await findAccount(supabase, user.id);
    if (!account) {
      await adapter.sendMessage({
        chatId: message.chat.id,
        text: "Compte Telegram non reconnu. Utilisez le lien personnel genere depuis GERIMMO.",
      });
      await supabase
        .from("bot_webhook_updates")
        .update({ status: "processed", processed_at: nowIso() })
        .eq("id", webhook.data.id);
      return { unrecognized: true };
    }

    await supabase
      .from("telegram_accounts")
      .update({ telegram_chat_id: message.chat.id, last_activity_at: nowIso() })
      .eq("id", account.id);
    await supabase
      .from("bot_webhook_updates")
      .update({ organization_id: account.organization_id })
      .eq("id", webhook.data.id);
    if (update.callback_query) {
      if (update.callback_query.message && update.callback_query.data) {
        await processCallback(
          supabase,
          adapter,
          toBotAccount(account, update.callback_query.message.chat.id),
          update.callback_query.data,
          update.callback_query.id,
          webhook.data.id,
        );
      }
    } else if (update.message) {
      await processConnectedMessage(
        supabase,
        adapter,
        toBotAccount(account, update.message.chat.id),
        toIncomingMessage(update.message, update.update_id),
        webhook.data.id,
      );
    }
    await supabase
      .from("bot_webhook_updates")
      .update({ status: "processed", processed_at: nowIso() })
      .eq("id", webhook.data.id);
    return { processed: true };
  } catch (error) {
    await Promise.all([
      supabase
        .from("bot_webhook_updates")
        .update({ status: "error", error_code: "PROCESSING_FAILED", processed_at: nowIso() })
        .eq("id", webhook.data.id),
      supabase.from("bot_errors").insert({
        error_code: "PROCESSING_FAILED",
        safe_message: "Le traitement du message a echoue.",
        internal_details: { message: safeError(error), updateId: update.update_id },
      }),
    ]);
    try {
      await adapter.sendMessage({
        chatId: message.chat.id,
        text: "Une erreur est survenue. Aucun dossier n a ete invente ni cree. Reessayez ou contactez votre responsable.",
      });
    } catch {
      // L erreur d envoi reste visible dans bot_webhook_updates et bot_errors.
    }
    return { error: true };
  }
}
