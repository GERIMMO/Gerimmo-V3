export type BotChannel = "telegram" | "whatsapp";
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
  telegram_account_id: string | null;
  whatsapp_account_id: string | null;
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

/**
 * Compte neutre vis-à-vis du canal : le cœur du bot ne manipule que cette forme.
 * `replyTarget` est la cible de réponse (chat id Telegram numérique ou wa_id WhatsApp).
 */
export type BotAccount = {
  id: string;
  channel: BotChannel;
  organization_id: string;
  profile_id: string;
  replyTarget: number | string;
};

export type BotIncomingAttachment = {
  kind: "photo" | "document";
  fileId: string;
  fileUniqueId: string;
  fileName: string | null;
  /** Type MIME déclaré par le canal ; null si inconnu avant téléchargement. */
  mimeType: string | null;
  /** Taille déclarée en octets ; null si inconnue avant téléchargement. */
  fileSize: number | null;
};

/** Message entrant normalisé, indépendant du canal (Telegram ou WhatsApp). */
export type BotIncomingMessage = {
  externalMessageId: number | string;
  text: string | null;
  caption: string | null;
  attachment: BotIncomingAttachment | null;
  metadata?: Record<string, unknown>;
};

export type BotOutgoingMessage = {
  // Telegram = chat id numérique ; WhatsApp = numéro E.164 (string).
  chatId: number | string;
  text: string;
  buttons?: Array<Array<{ text: string; callbackData: string }>>;
};

// --- WhatsApp Cloud API (Meta) : structures entrantes du webhook ---
export type WhatsAppInboundMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "interactive" | "image" | "document" | "button" | "audio" | "video" | string;
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  image?: { id: string; mime_type?: string; sha256?: string; caption?: string };
  document?: { id: string; mime_type?: string; filename?: string; caption?: string };
  button?: { text?: string; payload?: string };
};

export type WhatsAppInboundValue = {
  messaging_product: "whatsapp";
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id: string }>;
  messages?: WhatsAppInboundMessage[];
  statuses?: Array<Record<string, unknown>>;
};

export type WhatsAppWebhookPayload = {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{ value: WhatsAppInboundValue; field: string }>;
  }>;
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
