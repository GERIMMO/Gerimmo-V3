import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { applyBrandIdentity } from "@/services/bot/brand-rules";
import { resolveBotBrandIdentity } from "@/services/bot/branding";
import type { BotChannelAdapter } from "@/services/bot/channel";
import {
  allowedTenantDocumentTypes,
  classifyMessage,
  parseAvailabilitySlots,
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

export function roleMenu(role: string) {
  if (role === "artisan") {
    return {
      text: "Que souhaitez-vous faire ?",
      buttons: [
        [{ text: "Mes demandes", callbackData: "menu_schedule" }],
        [{ text: "Proposer des disponibilites", callbackData: "menu_schedule" }],
        [{ text: "Mes interventions", callbackData: "menu_interventions" }],
        [{ text: "Aide", callbackData: "menu_help" }],
      ],
    };
  }
  return {
    text: "Que souhaitez-vous faire ?",
    buttons: [
      [{ text: "Declarer un incident", callbackData: "menu_incident" }],
      [{ text: "Suivre mes incidents", callbackData: "menu_follow" }],
      [{ text: "Demander un document", callbackData: "menu_documents" }],
      [{ text: "Aide", callbackData: "menu_help" }],
    ],
  };
}

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
  } else if (data === "menu_interventions") {
    await sendAndLog(
      supabase,
      adapter,
      conversation,
      { text: "Consultez uniquement les interventions qui vous sont attribuees dans GERIMMO." },
      chatId,
    );
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
