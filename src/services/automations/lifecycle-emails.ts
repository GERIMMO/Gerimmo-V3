import { sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { templateForEvent } from "@/services/automations/lifecycle-template-map";
import { businessEmailTemplates, renderEmail } from "@/services/email-templates";

/**
 * E-mails du cycle de vie des abonnements (essai, paiements).
 *
 * L'application enregistre des événements dans `automation_events` ; personne ne les
 * consommait — n8n devait le faire et n'a jamais été activé. Les clients payants ne
 * recevaient donc ni confirmation de paiement, ni alerte d'échec, ni avis de fin d'essai.
 */

type EventRow = {
  id: string;
  organization_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
};

/** Contact de facturation d'une organisation : son responsable (propriétaire ou admin). */
async function findBillingContact(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const { data, error } = await admin
    .from("organization_members")
    .select("profiles!organization_members_profile_id_fkey(email,full_name)")
    .eq("organization_id", organizationId)
    .in("member_type", ["owner", "admin"])
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const profile = (data as { profiles?: { email?: string | null; full_name?: string | null } | null } | null)?.profiles;
  return profile?.email ? { email: profile.email, name: profile.full_name ?? "" } : null;
}

export type LifecycleDispatchResult = {
  sent: number;
  skipped: number;
  failed: number;
  failures: Array<{ id: string; message: string }>;
};

export async function dispatchLifecycleEmails(limit = 25): Promise<LifecycleDispatchResult> {
  const admin = createAdminClient();
  const pending = await admin
    .from("automation_events")
    .select("id,organization_id,event_type,payload")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (pending.error) throw pending.error;

  const events = (pending.data ?? []) as unknown as EventRow[];
  const failures: LifecycleDispatchResult["failures"] = [];
  let sent = 0;
  let skipped = 0;

  for (const event of events) {
    try {
      const code = templateForEvent(event.event_type);
      const template = code ? businessEmailTemplates.find((item) => item.code === code) : null;
      const contact = template ? await findBillingContact(admin, event.organization_id) : null;

      if (template && contact) {
        const variables = Object.fromEntries(
          Object.entries({ name: contact.name, ...(event.payload ?? {}) }).map(([key, value]) => [key, String(value)]),
        );
        const rendu = renderEmail(template, variables);
        await sendEmail({ to: contact.email, subject: rendu.subject, text: rendu.text, html: rendu.html });
        sent += 1;
      } else {
        // Événement interne, ou organisation sans contact de facturation joignable.
        skipped += 1;
      }

      // Acquitté dans tous les cas : un événement laissé en attente bloquerait la tête de
      // file (lecture ordonnée par date, limitée) et empêcherait les suivants de partir.
      const marked = await admin
        .from("automation_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", event.id)
        .select("id");
      if (marked.error) throw marked.error;
      if (!marked.data?.length) throw new Error("Evenement traite mais non acquitte : il repartirait en boucle.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Traitement impossible.";
      failures.push({ id: event.id, message });
      await admin
        .from("automation_events")
        .update({ status: "failed", last_error: message.slice(0, 500) })
        .eq("id", event.id);
    }
  }

  return { sent, skipped, failed: failures.length, failures };
}
