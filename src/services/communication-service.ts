import { randomUUID } from "node:crypto";

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

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentification requise.");
  const membership = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (!membership.data) throw new Error("Aucune organisation active.");
  return { supabase, user, organizationId: membership.data.organization_id };
}

export async function getCommunicationPayload(): Promise<CommunicationPayload> {
  const { supabase, user, organizationId } = await getContext();
  const [notifications, conversations, participants, messages, attachments, preferences, activity, profiles] =
    await Promise.all([
      supabase
        .from("communication_notifications" as never)
        .select("*")
        .eq("recipient_profile_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("communication_conversations" as never)
        .select("*")
        .is("archived_at", null)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(150),
      supabase
        .from("communication_participants" as never)
        .select("*,profiles(full_name,email)")
        .is("archived_at", null)
        .limit(500),
      supabase
        .from("communication_messages" as never)
        .select("*,profiles:sender_profile_id(full_name)")
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(1000),
      supabase
        .from("communication_attachments" as never)
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase
        .from("communication_preferences" as never)
        .select("*")
        .eq("organization_id", organizationId)
        .eq("profile_id", user.id)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("communication_activity_events" as never)
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
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
    profiles,
  ]) {
    if (result.error) throw result.error;
  }

  const profileIds = (profiles.data ?? []).map((row) => row.profile_id);
  const profileRows = profileIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", profileIds).is("archived_at", null)
    : { data: [], error: null };
  if (profileRows.error) throw profileRows.error;

  const preferenceRow = preferences.data as Record<string, unknown> | null;
  return {
    currentProfileId: user.id,
    organizationId,
    notifications: (notifications.data ?? []) as CommunicationNotification[],
    conversations: (conversations.data ?? []) as CommunicationConversation[],
    participants: (participants.data ?? []) as CommunicationParticipant[],
    messages: (messages.data ?? []) as CommunicationMessage[],
    attachments: (attachments.data ?? []) as CommunicationAttachment[],
    preferences: preferenceRow
      ? (preferenceRow as unknown as CommunicationPreferences)
      : {
          id: null,
          organization_id: organizationId,
          profile_id: user.id,
          application_enabled: true,
          email_enabled: true,
          telegram_enabled: false,
          categories: defaultCommunicationCategories,
          quiet_hours_start: null,
          quiet_hours_end: null,
        },
    activity: (activity.data ?? []) as CommunicationActivity[],
    profiles: (profileRows.data ?? []) as CommunicationProfile[],
  };
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
  const { supabase, user } = await getContext();
  const result = await supabase
    .from("communication_notifications" as never)
    .update({ read_at: read ? new Date().toISOString() : null } as never)
    .eq("id", notificationId)
    .eq("recipient_profile_id", user.id)
    .select("*")
    .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function createCommunicationConversation(input: CreateConversationInput) {
  const { supabase, user, organizationId } = await getContext();
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
  const { supabase, user, organizationId } = await getContext();
  if (!input.body.trim()) throw new Error("Le message est requis.");
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
  const { supabase, user, organizationId } = await getContext();
  if (input.profile_id !== user.id || input.organization_id !== organizationId)
    throw new Error("Preferences non autorisees.");
  const result = await supabase
    .from("communication_preferences" as never)
    .upsert(
      {
        organization_id: organizationId,
        profile_id: user.id,
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
