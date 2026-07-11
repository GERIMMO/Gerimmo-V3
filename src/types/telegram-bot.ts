export type BotChannel = "telegram";
export type BotRole = "locataire" | "artisan" | "responsable" | "proprietaire" | "agent" | "inconnu";
export type BotIntent =
  | "declarer_incident"
  | "suivre_incident"
  | "demander_document"
  | "proposer_disponibilites"
  | "aide"
  | "inconnu";
export type BotConversationStatus = "active" | "waiting_user" | "waiting_system" | "closed" | "error" | "archived";

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
};

export type TelegramPhotoSize = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

export type TelegramDocument = {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type BotClassification = {
  intent: BotIntent;
  categorySlug: string | null;
  confidence: number;
  matchedKeywords: string[];
  needsClarification: boolean;
};

export type BotConversation = {
  id: string;
  organization_id: string;
  profile_id: string;
  telegram_account_id: string;
  bien_id: string | null;
  incident_id: string | null;
  role_key: string | null;
  intent: BotIntent | null;
  state: string;
  status: BotConversationStatus;
  question_count: number;
  context: Record<string, unknown>;
  last_activity_at: string;
};

export type TelegramAccount = {
  id: string;
  organization_id: string;
  profile_id: string;
  telegram_user_id: number;
  telegram_chat_id: number;
  status: "connected" | "revoked" | "suspended" | "archived";
};

export type BotOutgoingMessage = {
  chatId: number;
  text: string;
  buttons?: Array<Array<{ text: string; callbackData: string }>>;
};

export type BotAdminPayload = {
  accounts: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
};

export type GenerateTelegramInvitationInput = {
  organization_id: string;
  profile_id: string;
  expiresInMinutes?: number;
};
