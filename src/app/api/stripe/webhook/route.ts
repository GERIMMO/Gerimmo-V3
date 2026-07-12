import { processStripeWebhook } from "@/services/stripe-service";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ message: "Signature manquante." }, { status: 400 });
  try {
    return Response.json(await processStripeWebhook(await request.text(), signature));
  } catch {
    return Response.json({ message: "Webhook Stripe invalide." }, { status: 400 });
  }
}
