import { createAdminClient } from "@/lib/supabase/admin";

// Endpoint d'automatisation loyers/documents, tiré par n8n (même secret que /api/automations/business).
function isAuthorized(request: Request) {
  const expected = process.env.N8N_BUSINESS_WEBHOOK_SECRET;
  return Boolean(expected && request.headers.get("x-gerimmo-automation-secret") === expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ message: "Accès refusé." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; month?: string; outboxId?: string };
  const admin = createAdminClient();

  // Cron mensuel : crée les loyers du mois pour toutes les locations actives.
  if (body.action === "generate_rent_periods") {
    const { data, error } = await admin.rpc(
      "generate_rent_periods_for_month",
      body.month ? { target_month: body.month } : {},
    );
    if (error) return Response.json({ message: error.message }, { status: 500 });
    return Response.json({ created: data });
  }

  // Cron quotidien : met en file les rappels d'échéance des documents officiels.
  if (body.action === "queue_document_reminders") {
    const { data, error } = await admin.rpc("queue_document_expiry_reminders");
    if (error) return Response.json({ message: error.message }, { status: 500 });
    return Response.json({ queued: data });
  }

  // n8n confirme l'envoi d'un e-mail : marque la ligne d'outbox comme envoyée.
  if (body.action === "mark_email_sent" && body.outboxId) {
    const { error } = await admin
      .from("document_email_outbox")
      .update({ status: "envoye", sent_at: new Date().toISOString() })
      .eq("id", body.outboxId);
    if (error) return Response.json({ message: error.message }, { status: 500 });
    return Response.json({ acknowledged: true });
  }

  // Corps vide : renvoie jusqu'à 50 e-mails prêts à envoyer (quittances, relances, rappels documents).
  const { data, error } = await admin
    .from("document_email_outbox")
    .select("id,organization_id,document_id,recipient_email,subject,body,created_at")
    .eq("status", "pret")
    .is("archived_at", null)
    .order("created_at")
    .limit(50);
  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json({ emails: data });
}
