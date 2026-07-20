import type Stripe from "stripe";

/**
 * Traduction d'un statut d'abonnement Stripe vers le statut GERIMMO.
 *
 * C'est cette correspondance qui décide si un client garde ou perd l'accès au produit :
 * elle mérite d'être isolée et testée. Logique volontairement PURE (l'import de Stripe est
 * un import de type, effacé à la compilation) : importer stripe-service dans un test
 * entraînerait le SDK Stripe et le client d'administration.
 *
 * Rappel des statuts Stripe : incomplete, incomplete_expired, trialing, active, past_due,
 * canceled, unpaid, paused.
 */
export function mapSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "trialing") return "trial";
  if (status === "active") return "active";
  if (status === "canceled") return "cancelled";
  // Impayé, en retard ou en pause : l'accès est suspendu, mais les données sont conservées.
  if (status === "paused" || status === "past_due" || status === "unpaid") return "suspended";
  // incomplete / incomplete_expired : le paiement initial n'a jamais abouti.
  return "expired";
}
