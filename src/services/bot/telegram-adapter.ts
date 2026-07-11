import type { BotChannelAdapter } from "@/services/bot/channel";
import type { BotOutgoingMessage } from "@/types/telegram-bot";

type TelegramApiResponse<T> = { ok: boolean; result?: T; description?: string };

export class TelegramAdapter implements BotChannelAdapter {
  readonly channel = "telegram" as const;
  private readonly token: string;
  private readonly apiBase: string;

  constructor(token = process.env.TELEGRAM_BOT_TOKEN) {
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN manquant.");
    }
    this.token = token;
    this.apiBase = `https://api.telegram.org/bot${token}`;
  }

  private async call<T>(method: string, payload: Record<string, unknown>) {
    const response = await fetch(`${this.apiBase}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !body.ok || body.result === undefined) {
      throw new Error(body.description ?? `Erreur Telegram ${response.status}.`);
    }
    return body.result;
  }

  async sendMessage(message: BotOutgoingMessage) {
    const result = await this.call<{ message_id: number }>("sendMessage", {
      chat_id: message.chatId,
      text: message.text,
      reply_markup: message.buttons
        ? {
            inline_keyboard: message.buttons.map((row) =>
              row.map((button) => ({ text: button.text, callback_data: button.callbackData })),
            ),
          }
        : undefined,
    });
    return { externalMessageId: result.message_id };
  }

  async answerCallback(callbackId: string, text?: string) {
    await this.call<boolean>("answerCallbackQuery", { callback_query_id: callbackId, text });
  }

  async downloadFile(fileId: string) {
    const file = await this.call<{ file_path: string }>("getFile", { file_id: fileId });
    const response = await fetch(`https://api.telegram.org/file/bot${this.token}/${file.file_path}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error("Telechargement Telegram impossible.");
    }
    return {
      bytes: await response.arrayBuffer(),
      filePath: file.file_path,
      mimeType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }
}
