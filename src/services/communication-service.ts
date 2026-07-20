import { createClient } from "@/lib/supabase/server";
import { defaultCommunicationCategories, isCommunicationAttachmentAllowed } from "@/services/communication-rules";
import type {
  CommunicationActivity,
  CommunicationAttachment,
  CommunicationConversation,
  CommunicationMessage,
  CommunicationNotification,
  CommunicationParticipant,
  CommunicationPayload,
  CommunicationPreferences,
  CommunicationProfile,
  CreateConversationInput,
  NotificationType,
} from "@/types/communication";

import { getSupervisionDataScope, narrowToSupervisionScopeProfile } from "./supervision-service";
import { randomUUID } from "node:crypto";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentification requise.");
  const supervision = await getSupervisionDataScope();
  if (supervision) {
    return {
      supabase,
      user,
      organizationId: supervision.organizationId,
      portalProfileId: supervision.profileIds?.includes(supervision.targetId) ? supervision.targetId : user.id,
      supervision,
    };
  }
  const membership = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (!membership.data) throw new Error("Aucune organisation active.");
  return {
    supabase,
    user,
    organizationId: membership.data.organization_id,
    portalProfileId: user.id,
    supervision: null,
  };
}

export async function getCommunicationPayload(): Promise<CommunicationPayload> {
  const { supabase, organizationId, portalProfileId, supervision } = await getContext();
  const [
    notifications,
    conversations,
    participants,
    messages,
    attachments,
    preferences,
    activity,
    auditActivity,
    userActivity,
    profiles,
  ] = await Promise.all([
    supabase
      .from("communication_notifications" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("recipient_profile_id", portalProfileId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("communication_conversations" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(150),
    supabase
      .from("communication_participants" as never)
      // Désambiguïsation obligatoire : communication_participants a deux clés étrangères
      // vers profiles (profile_id, archived_by) et PostgREST refuse de choisir (PGRST201).
      .select("*,profiles!communication_participants_profile_id_fkey(full_name,email)")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .limit(500),
    supabase
      .from("communication_messages" as never)
      .select("*,profiles:sender_profile_id(full_name)")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(1000),
    supabase
      .from("communication_attachments" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("communication_preferences" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("profile_id", portalProfileId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("communication_activity_events" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .eq("profile_id", portalProfileId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("audit_logs")
      .select("id,organization_id,actor_profile_id,action,table_name,record_id,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("user_activity_logs" as never)
      .select("id,organization_id,profile_id,actor_profile_id,action,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("organization_members")
      .select("profile_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .is("archived_at", null)
      .limit(500),
  ]);

  for (const result of [
    notifications,
    conversations,
    participants,
    messages,
    attachments,
    preferences,
    activity,
    auditActivity,
    userActivity,
    profiles,
  ]) {
    if (result.error) throw result.error;
  }

  const organizationProfileIds = (profiles.data ?? []).map((row) => row.profile_id);
  const profileIds = supervision?.profileIds ?? organizationProfileIds;
  const profileRows = profileIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", profileIds).is("archived_at", null)
    : { data: [], error: null };
  if (profileRows.error) throw profileRows.error;

  const allConversations = (conversations.data ?? []) as CommunicationConversation[];
  const allParticipants = (participants.data ?? []) as CommunicationParticipant[];
  const allMessages = (messages.data ?? []) as CommunicationMessage[];
  const allAttachments = (attachments.data ?? []) as CommunicationAttachment[];
  const allowedProfileIds = supervision?.profileIds ? new Set(supervision.profileIds) : null;
  const visibleConversationIds = new Set(
    allowedProfileIds
      ? allParticipants
          .filter((participant) => allowedProfileIds.has(participant.profile_id))
          .map((participant) => participant.conversation_id)
      : allConversations.map((conversation) => conversation.id),
  );
  const visibleMessages = allMessages.filter((message) => visibleConversationIds.has(message.conversation_id));
  const visibleMessageIds = new Set(visibleMessages.map((message) => message.id));
  const visibleAuditActivity = (auditActivity.data ?? []).filter(
    (event) =>
      !allowedProfileIds ||
      (event.actor_profile_id ? allowedProfileIds.has(event.actor_profile_id) : false) ||
      (event.record_id ? allowedProfileIds.has(event.record_id) : false),
  );
  const visibleUserActivity = (userActivity.data ?? []).filter((event) => {
    const row = event as Record<string, unknown>;
    return !allowedProfileIds || allowedProfileIds.has(String(row.profile_id));
  });
  const preferenceRow = preferences.data as Record<string, unknown> | null;
  return {
    currentProfileId: portalProfileId,
    organizationId,
    notifications: (notifications.data ?? []) as CommunicationNotification[],
    conversations: allConversations.filter((conversation) => visibleConversationIds.has(conversation.id)),
    participants: allParticipants.filter((participant) => visibleConversationIds.has(participant.conversation_id)),
    messages: visibleMessages,
    attachments: allAttachments.filter((attachment) => visibleMessageIds.has(attachment.message_id)),
    preferences: preferenceRow
      ? (preferenceRow as unknown as CommunicationPreferences)
      : {
          id: null,
          organization_id: organizationId,
          profile_id: portalProfileId,
          application_enabled: true,
          email_enabled: true,
          telegram_enabled: false,
          categories: defaultCommunicationCategories,
          quiet_hours_start: null,
          quiet_hours_end: null,
        },
    activity: [
      ...((activity.data ?? []) as CommunicationActivity[]),
      ...visibleAuditActivity.map((event) => ({
        id: event.id,
        organization_id: event.organization_id ?? organizationId,
        profile_id: portalProfileId,
        actor_profile_id: event.actor_profile_id,
        category: auditCategory(event.table_name),
        action: event.action,
        title: activityTitle(event.table_name, event.action),
        description: `Action enregistree dans ${event.table_name}`,
        entity_type: event.table_name,
        entity_id: event.record_id,
        created_at: event.created_at,
      })),
      ...visibleUserActivity.map((event) => ({
        id: String((event as Record<string, unknown>).id),
        organization_id: String((event as Record<string, unknown>).organization_id),
        profile_id: String((event as Record<string, unknown>).profile_id),
        actor_profile_id: stringOrNull((event as Record<string, unknown>).actor_profile_id),
        category: "utilisateur",
        action: String((event as Record<string, unknown>).action),
        title: "Activite utilisateur",
        description: String((event as Record<string, unknown>).action)
          .replaceAll("_", " ")
          .toLowerCase(),
        entity_type: "profile",
        entity_id: String((event as Record<string, unknown>).profile_id),
        created_at: String((event as Record<string, unknown>).created_at),
      })),
    ]
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(0, 600),
    profiles: (profileRows.data ?? []) as CommunicationProfile[],
  };
}

function auditCategory(tableName: string) {
  if (tableName.includes("incident")) return "incident";
  if (tableName.includes("document")) return "document";
  if (tableName.includes("bien") || tableName.includes("patrimoine") || tableName.includes("residence")) {
    return "patrimoine";
  }
  if (tableName.includes("profile") || tableName.includes("member") || tableName.includes("user")) return "utilisateur";
  return "systeme";
}

function activityTitle(tableName: string, action: string) {
  return `${action.replaceAll("_", " ").toLowerCase()} · ${tableName.replaceAll("_", " ")}`;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function createCommunicationNotification(input: {
  recipient_profile_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  priority?: string;
  action_url?: string | null;
}) {
  const { supabase, user, organizationId } = await getContext();
  await narrowToSupervisionScopeProfile(input.recipient_profile_id, organizationId);
  const result = await supabase
    .from("communication_notifications" as never)
    .insert({
      organization_id: organizationId,
      recipient_profile_id: input.recipient_profile_id,
      actor_profile_id: user.id,
      notification_type: input.notification_type,
      title: input.title.trim(),
      body: input.body.trim(),
      priority: input.priority ?? "normale",
      action_url: input.action_url ?? null,
    } as never)
    .select("*")
    .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function markNotificationRead(notificationId: string, read: boolean) {
  const { supabase, organizationId, portalProfileId, supervision } = await getContext();
  if (supervision?.profileIds) await narrowToSupervisionScopeProfile(portalProfileId, organizationId);
  const result = await supabase
    .from("communication_notifications" as never)
    .update({ read_at: read ? new Date().toISOString() : null } as never)
    .eq("id", notificationId)
    .eq("organization_id", organizationId)
    .eq("recipient_profile_id", portalProfileId)
    .select("*")
    .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function createCommunicationConversation(input: CreateConversationInput) {
  const { supabase, user, organizationId, supervision } = await getContext();
  if (input.organization_id !== organizationId) throw new Error("Organisation non autorisee.");
  const recipients = [...new Set(input.participant_profile_ids.filter((id) => id !== user.id))];
  const allowed = await supabase
    .from("organization_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("archived_at", null)
    .in("profile_id", recipients);
  if (allowed.error || (allowed.data?.length ?? 0) !== recipients.length) throw new Error("Participant non autorise.");
  if (supervision?.profileIds && !recipients.some((profileId) => supervision.profileIds?.includes(profileId))) {
    throw new Error("La conversation doit inclure le portail actuellement supervisé.");
  }

  const conversation = await supabase
    .from("communication_conversations" as never)
    .insert({
      organization_id: organizationId,
      subject: input.subject.trim(),
      conversation_type: recipients.length > 1 ? "groupe" : "directe",
      created_by: user.id,
    } as never)
    .select("*")
    .single();
  if (conversation.error) throw conversation.error;
  const conversationId = (conversation.data as { id: string }).id;
  const participantRows = [user.id, ...recipients].map((profileId) => ({
    organization_id: organizationId,
    conversation_id: conversationId,
    profile_id: profileId,
    participant_role: profileId === user.id ? "administrateur" : "membre",
  }));
  const participantInsert = await supabase.from("communication_participants" as never).insert(participantRows as never);
  if (participantInsert.error) throw participantInsert.error;
  await sendCommunicationMessage({ conversation_id: conversationId, body: input.first_message }, []);
  return conversation.data;
}

export async function sendCommunicationMessage(input: { conversation_id: string; body: string }, files: File[]) {
  const { supabase, user, organizationId, supervision } = await getContext();
  if (!input.body.trim()) throw new Error("Le message est requis.");
  const conversation = await supabase
    .from("communication_conversations" as never)
    .select("id")
    .eq("id", input.conversation_id)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .maybeSingle();
  if (conversation.error || !conversation.data) throw new Error("Conversation non autorisée.");
  if (supervision?.profileIds) {
    const participant = await supabase
      .from("communication_participants" as never)
      .select("profile_id")
      .eq("conversation_id", input.conversation_id)
      .eq("organization_id", organizationId)
      .in("profile_id", supervision.profileIds)
      .is("archived_at", null)
      .limit(1);
    if (participant.error || !participant.data?.length) throw new Error("Conversation hors du contexte supervisé.");
  }
  const message = await supabase
    .from("communication_messages" as never)
    .insert({
      organization_id: organizationId,
      conversation_id: input.conversation_id,
      sender_profile_id: user.id,
      body: input.body.trim(),
    } as never)
    .select("*")
    .single();
  if (message.error) throw message.error;
  const messageId = (message.data as { id: string }).id;

  for (const file of files) {
    if (!isCommunicationAttachmentAllowed(file.type, file.size)) {
      throw new Error("Piece jointe invalide. Formats autorises : JPG, PNG, WEBP, PDF et TXT, 10 Mo maximum.");
    }
    const safeName = file.name.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${organizationId}/${input.conversation_id}/${user.id}/${randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("communication-attachments").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) throw upload.error;
    const attachment = await supabase.from("communication_attachments" as never).insert({
      organization_id: organizationId,
      conversation_id: input.conversation_id,
      message_id: messageId,
      uploaded_by: user.id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
    } as never);
    if (attachment.error) throw attachment.error;
  }
  return message.data;
}

export async function saveCommunicationPreferences(input: Omit<CommunicationPreferences, "id">) {
  const { supabase, organizationId, portalProfileId, supervision } = await getContext();
  if (input.profile_id !== portalProfileId || input.organization_id !== organizationId)
    throw new Error("Preferences non autorisees.");
  if (supervision?.profileIds) await narrowToSupervisionScopeProfile(portalProfileId, organizationId);
  const result = await supabase
    .from("communication_preferences" as never)
    .upsert(
      {
        organization_id: organizationId,
        profile_id: portalProfileId,
        application_enabled: input.application_enabled,
        email_enabled: input.email_enabled,
        telegram_enabled: input.telegram_enabled,
        categories: input.categories,
        quiet_hours_start: input.quiet_hours_start,
        quiet_hours_end: input.quiet_hours_end,
      } as never,
      { onConflict: "organization_id,profile_id" },
    )
    .select("*")
    .single();
  if (result.error) throw result.error;
  return result.data;
}
