export type NotificationType = "systeme" | "incident" | "document" | "loyer" | "devis" | "intervention";
export type NotificationPriority = "basse" | "normale" | "haute" | "urgente";

export type CommunicationNotification = {
  id: string;
  organization_id: string;
  recipient_profile_id: string;
  actor_profile_id: string | null;
  notification_type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  archived_at: string | null;
};

export type CommunicationConversation = {
  id: string;
  organization_id: string;
  subject: string;
  conversation_type: "directe" | "groupe" | "support";
  created_by: string;
  last_message_at: string | null;
  created_at: string;
  archived_at: string | null;
};

export type CommunicationParticipant = {
  id: string;
  organization_id: string;
  conversation_id: string;
  profile_id: string;
  participant_role: "membre" | "administrateur";
  last_read_at: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export type CommunicationMessage = {
  id: string;
  organization_id: string;
  conversation_id: string;
  sender_profile_id: string;
  reply_to_message_id: string | null;
  body: string;
  status: "envoye" | "modifie" | "archive";
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  archived_at: string | null;
  profiles?: { full_name: string | null } | null;
};

export type CommunicationAttachment = {
  id: string;
  organization_id: string;
  conversation_id: string;
  message_id: string;
  uploaded_by: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  archived_at: string | null;
};

export type CommunicationPreferences = {
  id: string | null;
  organization_id: string;
  profile_id: string;
  application_enabled: boolean;
  email_enabled: boolean;
  telegram_enabled: boolean;
  categories: Record<NotificationType, boolean>;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export type CommunicationActivity = {
  id: string;
  organization_id: string;
  profile_id: string;
  actor_profile_id: string | null;
  category: string;
  action: string;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export type CommunicationProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type CommunicationPayload = {
  currentProfileId: string;
  organizationId: string;
  notifications: CommunicationNotification[];
  conversations: CommunicationConversation[];
  participants: CommunicationParticipant[];
  messages: CommunicationMessage[];
  attachments: CommunicationAttachment[];
  preferences: CommunicationPreferences;
  activity: CommunicationActivity[];
  profiles: CommunicationProfile[];
};

export type CreateConversationInput = {
  organization_id: string;
  subject: string;
  participant_profile_ids: string[];
  first_message: string;
};
