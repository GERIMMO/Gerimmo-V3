import type { BotChannelAdapter } from "@/services/bot/channel";
import type { BotOutgoingMessage } from "@/types/telegram-bot";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Limites WhatsApp Cloud API.
const BUTTON_TITLE_MAX = 20;
const LIST_ROW_TITLE_MAX = 24;
const MAX_REPLY_BUTTONS = 3;
const MAX_LIST_ROWS = 10;

type GraphError = { error?: { message?: string; type?: string; code?: number } };

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Adaptateur WhatsApp (API officielle Meta / WhatsApp Cloud API).
 * Implémente la même interface que l'adaptateur Telegram pour que le cœur du bot
 * reste indépendant du canal.
 */
export class WhatsAppAdapter implements BotChannelAdapter {
  readonly channel = "whatsapp" as const;
  private readonly token: string;
  private readonly phoneNumberId: string;

  constructor(token = process.env.WHATSAPP_ACCESS_TOKEN, phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID) {
    if (!token) {
      throw new Error("WHATSAPP_ACCESS_TOKEN manquant.");
    }
    if (!phoneNumberId) {
      throw new Error("WHATSAPP_PHONE_NUMBER_ID manquant.");
    }
    this.token = token;
    this.phoneNumberId = phoneNumberId;
  }

  private authHeaders(extra?: Record<string, string>) {
    return { authorization: `Bearer ${this.token}`, ...extra };
  }

  private async call<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${GRAPH_BASE}/${path}`, {
      method: "POST",
      headers: this.authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json().catch(() => ({}))) as GraphError & Record<string, unknown>;
    if (!response.ok || body.error) {
      throw new Error(body.error?.message ?? `Erreur WhatsApp ${response.status}.`);
    }
    return body as T;
  }

  /** Construit le corps `interactive` (boutons ≤3, sinon liste). */
  private buildInteractive(text: string, buttons: BotOutgoingMessage["buttons"]) {
    const flat = (buttons ?? []).flat();
    if (flat.length === 0) return null;

    if (flat.length <= MAX_REPLY_BUTTONS) {
      return {
        type: "button",
        body: { text },
        action: {
          buttons: flat.map((button) => ({
            type: "reply",
            reply: { id: button.callbackData, title: truncate(button.text, BUTTON_TITLE_MAX) },
          })),
        },
      };
    }

    return {
      type: "list",
      body: { text },
      action: {
        button: "Choisir",
        sections: [
          {
            rows: flat.slice(0, MAX_LIST_ROWS).map((button) => ({
              id: button.callbackData,
              title: truncate(button.text, LIST_ROW_TITLE_MAX),
            })),
          },
        ],
      },
    };
  }

  async sendMessage(message: BotOutgoingMessage) {
    const to = String(message.chatId);
    const interactive = this.buildInteractive(message.text, message.buttons);

    const payload = interactive
      ? { messaging_product: "whatsapp", to, type: "interactive", interactive }
      : { messaging_product: "whatsapp", to, type: "text", text: { body: message.text, preview_url: false } };

    const result = await this.call<{ messages?: Array<{ id: string }> }>(`${this.phoneNumberId}/messages`, payload);
    const externalMessageId = result.messages?.[0]?.id;
    if (!externalMessageId) {
      throw new Error("Réponse WhatsApp sans identifiant de message.");
    }
    return { externalMessageId };
  }

  /**
   * WhatsApp n'a pas d'« accusé de callback » comme Telegram.
   * Les boutons interactifs renvoient un message entrant classique ; ce hook est donc neutre.
   */
  async answerCallback(_callbackId: string, _text?: string) {
    return;
  }

  /**
   * Abonne le compte WhatsApp Business (WABA) à cette application. Étape indispensable pour
   * que Meta aiguille les messages entrants vers le webhook (POST {WABA}/subscribed_apps, idempotent).
   */
  async subscribeAccount(businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    if (!businessAccountId) {
      throw new Error("WHATSAPP_BUSINESS_ACCOUNT_ID manquant.");
    }
    return this.call<{ success?: boolean }>(`${businessAccountId}/subscribed_apps`, {});
  }

  /** Télécharge un média entrant : récupère l'URL signée puis le binaire. */
  async downloadFile(mediaId: string) {
    const metaResponse = await fetch(`${GRAPH_BASE}/${mediaId}`, {
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(8_000),
    });
    const meta = (await metaResponse.json().catch(() => ({}))) as GraphError & {
      url?: string;
      mime_type?: string;
    };
    if (!metaResponse.ok || meta.error || !meta.url) {
      throw new Error(meta.error?.message ?? "Média WhatsApp introuvable.");
    }

    const fileResponse = await fetch(meta.url, {
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!fileResponse.ok) {
      throw new Error("Téléchargement WhatsApp impossible.");
    }

    return {
      bytes: await fileResponse.arrayBuffer(),
      filePath: mediaId,
      mimeType: meta.mime_type ?? fileResponse.headers.get("content-type") ?? "application/octet-stream",
    };
  }
}
