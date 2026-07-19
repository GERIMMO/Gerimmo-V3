import { after } from "next/server";

import { verifyWebhookChallenge, verifyWhatsAppSignature } from "@/services/bot/whatsapp-parse";
import { processWhatsAppUpdate } from "@/services/whatsapp-bot-service";
import type { WhatsAppWebhookPayload } from "@/types/telegram-bot";

export const maxDuration = 30;

// Vérification d'abonnement du webhook (Meta appelle en GET lors de la configuration).
export function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = verifyWebhookChallenge(
    url.searchParams.get("hub.mode"),
    url.searchParams.get("hub.verify_token"),
    url.searchParams.get("hub.challenge"),
    process.env.WHATSAPP_VERIFY_TOKEN,
  );
  if (challenge === null) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

// Réception des messages entrants (POST signé par Meta).
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) {
    return Response.json({ message: "Acces refuse." }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return Response.json({ message: "Corps de requete invalide." }, { status: 400 });
  }

  // WhatsApp exige un 200 rapide ; le traitement se fait en arrière-plan.
  after(() => processWhatsAppUpdate(payload));
  return Response.json({ accepted: true });
}
