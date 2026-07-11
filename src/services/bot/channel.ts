import type { BotOutgoingMessage } from "@/types/telegram-bot";

export interface BotChannelAdapter {
  readonly channel: "telegram";
  sendMessage(message: BotOutgoingMessage): Promise<{ externalMessageId: number }>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
  downloadFile(fileId: string): Promise<{ bytes: ArrayBuffer; filePath: string; mimeType: string }>;
}
