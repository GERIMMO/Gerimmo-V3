/**
 * Correspondance événement d'abonnement → code de modèle d'e-mail.
 *
 * Logique PURE, isolée pour être testable : le service qui l'utilise importe le client
 * Supabase et l'envoi d'e-mails, ce qui la rendrait inatteignable depuis un test.
 *
 * Tous les événements ne s'adressent pas au client : `communication.publish`,
 * `quality.reported`, `workflow.retry` et les types Stripe bruts (`customer.subscription.*`,
 * `invoice.paid`) sont internes et ne déclenchent aucun envoi.
 */
export function templateForEvent(eventType: string): string | null {
  if (eventType === "trial.started") return "trial_started";
  if (eventType === "trial.expired") return "trial_ended";
  if (eventType === "payment.succeeded") return "payment_succeeded";
  if (eventType === "payment.failed") return "payment_failed";
  return null;
}
