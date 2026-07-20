import { syncStripePrices } from "@/services/stripe-service";

// Création des tarifs Stripe manquants (mensuel, mise en place, gestion annuelle) à partir
// des montants enregistrés. Réservé au super administrateur, vérifié dans le service.
export async function POST() {
  try {
    return Response.json(await syncStripePrices());
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Synchronisation impossible." },
      { status: 500 },
    );
  }
}
