import type { WhatsAppInboundMessage, WhatsAppWebhookPayload } from "@/types/telegram-bot";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vérifie le challenge d'abonnement du webhook (GET).
 * Meta appelle `?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`.
 * Retourne le challenge à renvoyer tel quel, ou null si le token ne correspond pas.
 */
export function verifyWebhookChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  expectedToken: string | undefined,
): string | null {
  if (mode === "subscribe" && token && expectedToken && token === expectedToken && challenge) {
    return challenge;
  }
  return null;
}

/**
 * Valide la signature `X-Hub-Signature-256` (HMAC SHA-256 du corps brut avec l'App Secret Meta).
 * Comparaison à temps constant. Retourne false si un élément manque.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  return received.length === computed.length && timingSafeEqual(received, computed);
}

export type WhatsAppEvent = {
  waId: string;
  contactName: string | null;
  messageId: string;
  timestamp: string;
  kind: "text" | "button_reply" | "media" | "other";
  text: string | null;
  /** Identifiant du bouton/ligne choisi (équivalent du callbackData Telegram). */
  callbackData: string | null;
  media: {
    id: string;
    kind: "image" | "document";
    caption: string | null;
    mimeType: string | null;
    fileName: string | null;
  } | null;
};

function normalizeMessage(message: WhatsAppInboundMessage, contactName: string | null): WhatsAppEvent {
  const base = {
    waId: message.from,
    contactName,
    messageId: message.id,
    timestamp: message.timestamp,
  };

  if (message.type === "text" && message.text?.body) {
    return { ...base, kind: "text", text: message.text.body, callbackData: null, media: null };
  }

  if (message.type === "interactive" && message.interactive) {
    const reply = message.interactive.button_reply ?? message.interactive.list_reply;
    return {
      ...base,
      kind: "button_reply",
      text: reply ? reply.title : null,
      callbackData: reply ? reply.id : null,
      media: null,
    };
  }

  // Bouton de template (quick reply) : payload = équivalent callbackData.
  if (message.type === "button" && message.button) {
    return {
      ...base,
      kind: "button_reply",
      text: message.button.text ?? null,
      callbackData: message.button.payload ?? null,
      media: null,
    };
  }

  if (message.type === "image" && message.image) {
    return {
      ...base,
      kind: "media",
      text: message.image.caption ?? null,
      callbackData: null,
      media: {
        id: message.image.id,
        kind: "image",
        caption: message.image.caption ?? null,
        mimeType: message.image.mime_type ?? null,
        fileName: null,
      },
    };
  }

  if (message.type === "document" && message.document) {
    return {
      ...base,
      kind: "media",
      text: message.document.caption ?? null,
      callbackData: null,
      media: {
        id: message.document.id,
        kind: "document",
        caption: message.document.caption ?? null,
        mimeType: message.document.mime_type ?? null,
        fileName: message.document.filename ?? null,
      },
    };
  }

  return { ...base, kind: "other", text: null, callbackData: null, media: null };
}

/**
 * Aplati un payload de webhook WhatsApp en événements normalisés, indépendants du format Meta.
 * Ignore les accusés de statut (`statuses`) qui ne sont pas des messages entrants.
 */
export function parseWhatsAppEvents(payload: WhatsAppWebhookPayload): WhatsAppEvent[] {
  if (payload.object !== "whatsapp_business_account") return [];
  const events: WhatsAppEvent[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;
      const contactName = value.contacts?.[0]?.profile?.name ?? null;
      for (const message of value.messages) {
        events.push(normalizeMessage(message, contactName));
      }
    }
  }

  return events;
}
