import { createAdminClient } from "@/lib/supabase/admin";

export async function runProductionHealthCheck() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const [events, stripe, bot, automations] = await Promise.all([
    admin
      .from("observability_events")
      .select("source,severity,fingerprint,message,duration_ms")
      .gte("occurred_at", since),
    admin
      .from("stripe_webhook_events")
      .select("id,event_type,last_error")
      .eq("status", "failed")
      .gte("received_at", since),
    admin.from("bot_errors").select("id,error_code,safe_message").gte("created_at", since),
    admin.from("automation_events").select("id,event_type,payload").eq("status", "failed").gte("created_at", since),
  ]);
  for (const result of [events, stripe, bot, automations]) if (result.error) throw result.error;
  const candidates: Array<{
    fingerprint: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    source: string;
    count: number;
  }> = [];
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const event of events.data ?? []) {
    const fingerprint = event.fingerprint ?? `${event.source}:${event.message}`;
    grouped.set(fingerprint, [...(grouped.get(fingerprint) ?? []), event]);
  }
  for (const [fingerprint, rows] of grouped) {
    const slow = rows.some((row) => Number(row.duration_ms) > 1500);
    const errors = rows.filter((row) => ["error", "critical"].includes(String(row.severity))).length;
    if (errors >= 3 || slow)
      candidates.push({
        fingerprint: `health:${fingerprint}`,
        type: slow ? "api_slow" : "repeated_error",
        severity: errors >= 10 ? "critical" : "warning",
        title: slow ? "API ou écran lent" : "Erreurs répétées",
        message: String(rows[0]?.message ?? "Événement répété"),
        source: String(rows[0]?.source ?? "system"),
        count: rows.length,
      });
  }
  if ((stripe.data ?? []).length)
    candidates.push({
      fingerprint: "health:stripe-webhook",
      type: "webhook_down",
      severity: "critical",
      title: "Webhook Stripe en erreur",
      message: "Des événements Stripe n’ont pas été traités.",
      source: "api",
      count: stripe.data?.length ?? 0,
    });
  if ((bot.data ?? []).length >= 3)
    candidates.push({
      fingerprint: "health:telegram",
      type: "telegram_error",
      severity: "warning",
      title: "Erreurs Telegram répétées",
      message: "Le bot Telegram nécessite une vérification.",
      source: "telegram",
      count: bot.data?.length ?? 0,
    });
  if ((automations.data ?? []).length)
    candidates.push({
      fingerprint: "health:n8n",
      type: "workflow_stopped",
      severity: "warning",
      title: "Automatisation en échec",
      message: "Un ou plusieurs événements d’automatisation sont arrêtés.",
      source: "n8n",
      count: automations.data?.length ?? 0,
    });
  for (const candidate of candidates)
    await admin.from("monitoring_alerts").upsert(
      {
        alert_type: candidate.type,
        severity: candidate.severity,
        title: candidate.title,
        message: candidate.message,
        source: candidate.source,
        fingerprint: candidate.fingerprint,
        occurrence_count: candidate.count,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "fingerprint,status" },
    );
  return { checkedAt: new Date().toISOString(), alertsCreatedOrUpdated: candidates.length };
}

export async function registerBackupVerification(type: "daily" | "weekly") {
  const admin = createAdminClient();
  const previous = await admin
    .from("backup_registry")
    .select("id,completed_at")
    .eq("backup_type", type)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const maximumAge = type === "daily" ? 36 * 3600_000 : 8 * 86400_000;
  const healthy = Boolean(
    previous.data?.completed_at && Date.now() - new Date(previous.data.completed_at).getTime() < maximumAge,
  );
  if (!healthy)
    await admin.from("monitoring_alerts").upsert(
      {
        alert_type: "backup_missing",
        severity: "critical",
        title: `Sauvegarde ${type === "daily" ? "quotidienne" : "hebdomadaire"} non confirmée`,
        message: "Vérifiez les sauvegardes gérées Supabase avant toute restauration.",
        source: "system",
        fingerprint: `backup:${type}`,
        occurrence_count: 1,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "fingerprint,status" },
    );
  return { type, healthy, lastCompletedAt: previous.data?.completed_at ?? null };
}
