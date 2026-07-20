import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/services/administration-service";
import { planDailyAutomations } from "@/services/automations/daily-plan";
import { dispatchPendingEmails } from "@/services/email-dispatch-service";

/**
 * Tâche quotidienne des automatisations métier : génération des loyers du mois (le 1er),
 * mise en file des rappels de documents, puis envoi des e-mails en attente.
 *
 * Remplace le rôle que devait tenir n8n. Toute la logique métier était déjà côté GERIMMO
 * (fonctions SQL + services) ; il ne manquait que le déclencheur et l'envoi. Une seule
 * tâche planifiée orchestre le tout, ce qui reste compatible avec la formule Vercel
 * gratuite (une exécution par jour).
 *
 * GET  : appelé par Vercel Cron, authentifié par CRON_SECRET (même convention que
 *        /api/cron/production-health).
 * POST : déclenchement manuel par un super administrateur connecté — utile pour ne pas
 *        dépendre uniquement de la planification, et pour vérifier un envoi immédiatement.
 */
async function runAutomations() {
  const admin = createAdminClient();
  const plan = planDailyAutomations(new Date());
  const report: Record<string, unknown> = {};

  if (plan.generateRentPeriods) {
    const { data, error } = await admin.rpc("generate_rent_periods_for_month", {});
    if (error) throw error;
    report.rentPeriodsCreated = data;
  }

  if (plan.queueDocumentReminders) {
    const { data, error } = await admin.rpc("queue_document_expiry_reminders");
    if (error) throw error;
    report.documentRemindersQueued = data;
  }

  if (plan.dispatchEmails) {
    report.emails = await dispatchPendingEmails();
  }

  return report;
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || provided !== expected) return Response.json({ message: "Accès refusé." }, { status: 401 });
  try {
    return Response.json(await runAutomations());
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Automatisations impossibles." },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    await requireSuperAdmin();
    return Response.json(await runAutomations());
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Automatisations impossibles." },
      { status: 500 },
    );
  }
}
