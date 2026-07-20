import { mapSubscriptionStatus } from "../src/services/billing/subscription-status.ts";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Correspondance statut Stripe → statut GERIMMO.
 *
 * C'est elle qui decide si un client garde ou perd l'acces au produit : une erreur ici
 * coute de l'argent (acces maintenu sans paiement) ou coute un client (acces coupe alors
 * qu'il a paye). D'ou un test exhaustif des huit statuts Stripe.
 */

test("un essai et un abonnement paye donnent l'acces", () => {
  assert.equal(mapSubscriptionStatus("trialing"), "trial");
  assert.equal(mapSubscriptionStatus("active"), "active");
});

test("un impaye, un retard ou une pause suspendent l'acces sans effacer le compte", () => {
  for (const statut of ["past_due", "unpaid", "paused"] as const) {
    assert.equal(mapSubscriptionStatus(statut), "suspended", `statut ${statut}`);
  }
});

test("une resiliation est distinguee d'une suspension", () => {
  // 'cancelled' et 'suspended' ne se valent pas : la resiliation est definitive, la
  // suspension est rattrapable par un paiement.
  assert.equal(mapSubscriptionStatus("canceled"), "cancelled");
  assert.notEqual(mapSubscriptionStatus("canceled"), mapSubscriptionStatus("past_due"));
});

test("un paiement initial jamais abouti n'ouvre aucun acces", () => {
  for (const statut of ["incomplete", "incomplete_expired"] as const) {
    assert.equal(mapSubscriptionStatus(statut), "expired", `statut ${statut}`);
  }
});

test("aucun statut Stripe ne donne l'acces par defaut", () => {
  // Garde-fou : si Stripe introduit un nouveau statut, il doit retomber sur 'expired'
  // (ferme), jamais sur 'active'. On le verifie avec une valeur inconnue.
  const inconnu = "un_statut_que_stripe_ajouterait" as Parameters<typeof mapSubscriptionStatus>[0];
  assert.equal(mapSubscriptionStatus(inconnu), "expired");
});
