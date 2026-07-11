import { after } from "next/server";

import { processTelegramUpdate } from "@/services/telegram-bot-service";
import type { TelegramUpdate } from "@/types/telegram-bot";

import { timingSafeEqual } from "node:crypto";

export const maxDuration = 30;

function isValidSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function GET() {
  return Response.json({
    channel: "telegram",
    configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET && process.env.TELEGRAM_BOT_USERNAME,
    ),
  });
}

export async function POST(request: Request) {
  if (!isValidSecret(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return Response.json({ message: "Acces refuse." }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ message: "Corps de requete invalide." }, { status: 400 });
  }

  if (!Number.isSafeInteger(update.update_id)) {
    return Response.json({ message: "Mise a jour Telegram invalide." }, { status: 400 });
  }

  after(() => processTelegramUpdate(update));
  return Response.json({ accepted: true });
}
