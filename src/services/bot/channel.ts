import type { BotChannel, BotOutgoingMessage } from "@/types/telegram-bot";

export interface BotChannelAdapter {
  readonly channel: BotChannel;
  sendMessage(message: BotOutgoingMessage): Promise<{ externalMessageId: string | number }>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
  downloadFile(fileId: string): Promise<{ bytes: ArrayBuffer; filePath: string; mimeType: string }>;
}
