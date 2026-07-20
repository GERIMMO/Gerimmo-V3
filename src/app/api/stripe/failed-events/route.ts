import { listFailedStripeEvents, replayStripeEvent } from "@/services/stripe-service";

// Suivi et rejeu des événements Stripe en échec. Réservé au super administrateur (vérifié
// dans le service).
export async function GET() {
  try {
    return Response.json({ events: await listFailedStripeEvents() });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { eventId } = (await request.json()) as { eventId?: string };
    if (!eventId) return Response.json({ message: "Événement requis." }, { status: 400 });
    return Response.json(await replayStripeEvent(eventId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Rejeu impossible." }, { status: 500 });
  }
}
