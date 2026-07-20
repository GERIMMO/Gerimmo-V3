import { planDailyAutomations } from "../src/services/automations/daily-plan.ts";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Plan de la tache quotidienne. Une erreur ici se voit tard et coute cher : des loyers
 * generes plusieurs fois par mois, ou jamais.
 */

test("les loyers du mois ne sont generes que le 1er", () => {
  assert.equal(planDailyAutomations(new Date("2026-08-01T07:00:00Z")).generateRentPeriods, true);
  for (const jour of ["2026-08-02", "2026-08-15", "2026-08-28", "2026-08-31"]) {
    assert.equal(
      planDailyAutomations(new Date(`${jour}T07:00:00Z`)).generateRentPeriods,
      false,
      `aucun loyer ne doit etre genere le ${jour}`,
    );
  }
});

test("le 1er est reconnu quel que soit le mois, y compris fevrier", () => {
  for (const mois of ["01", "02", "06", "12"]) {
    assert.equal(planDailyAutomations(new Date(`2026-${mois}-01T07:00:00Z`)).generateRentPeriods, true);
  }
});

test("les rappels de documents et l'envoi des e-mails tournent tous les jours", () => {
  for (const jour of ["2026-08-01", "2026-08-17", "2026-08-31"]) {
    const plan = planDailyAutomations(new Date(`${jour}T07:00:00Z`));
    assert.equal(plan.queueDocumentReminders, true, `rappels attendus le ${jour}`);
    assert.equal(plan.dispatchEmails, true, `envoi attendu le ${jour}`);
  }
});
