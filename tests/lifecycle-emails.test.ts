import { templateForEvent } from "../src/services/automations/lifecycle-template-map.ts";
import { businessEmailTemplates } from "../src/services/email-templates.ts";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Quel evenement declenche quel e-mail client. Une erreur ici se traduit soit par un
 * silence (le client paie et n'a aucune confirmation), soit par un e-mail inopportun.
 */

test("les quatre evenements clients declenchent leur e-mail", () => {
  assert.equal(templateForEvent("trial.started"), "trial_started");
  assert.equal(templateForEvent("trial.expired"), "trial_ended");
  assert.equal(templateForEvent("payment.succeeded"), "payment_succeeded");
  assert.equal(templateForEvent("payment.failed"), "payment_failed");
});

test("les evenements internes n'envoient rien au client", () => {
  for (const interne of [
    "communication.publish",
    "quality.reported",
    "workflow.retry",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
  ]) {
    assert.equal(templateForEvent(interne), null, `${interne} ne doit declencher aucun e-mail`);
  }
});

test("chaque modele designe existe reellement", () => {
  // Garde-fou : une faute de frappe dans un code de modele produirait un silence complet,
  // l'evenement etant acquitte sans qu'aucun e-mail ne parte.
  const codes = new Set(businessEmailTemplates.map((template) => template.code));
  for (const evenement of ["trial.started", "trial.expired", "payment.succeeded", "payment.failed"]) {
    const code = templateForEvent(evenement);
    assert.ok(code, `${evenement} doit designer un modele`);
    assert.ok(codes.has(code as string), `le modele ${code} doit exister dans businessEmailTemplates`);
  }
});
