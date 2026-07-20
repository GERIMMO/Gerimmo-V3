/**
 * Ce que la tâche quotidienne doit faire selon le jour.
 *
 * Logique PURE, isolée pour être testable : une erreur ici se traduirait par des loyers
 * générés douze fois par an au mauvais moment, ou pas du tout.
 */

export type DailyPlan = {
  /** Les échéances de loyer se créent une fois par mois, le 1er. L'opération est idempotente. */
  generateRentPeriods: boolean;
  /** Les rappels de documents officiels sont mis en file tous les jours (anti-doublon en base). */
  queueDocumentReminders: boolean;
  /** La file d'e-mails est vidée à chaque passage. */
  dispatchEmails: boolean;
};

export function planDailyAutomations(now: Date): DailyPlan {
  return {
    generateRentPeriods: now.getDate() === 1,
    queueDocumentReminders: true,
    dispatchEmails: true,
  };
}
