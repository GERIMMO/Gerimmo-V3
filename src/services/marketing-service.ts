import { createAdminClient } from "@/lib/supabase/admin";

import { requireSuperAdmin } from "./administration-service";

export async function getMarketingCenter() {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const [leads, subscriptions, invoices, events] = await Promise.all([
    admin
      .from("commercial_leads")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("organization_subscriptions").select("status,created_at"),
    admin.from("billing_invoices").select("total_cents,status,paid_at"),
    admin
      .from("marketing_events")
      .select("event_type,occurred_at")
      .gte("occurred_at", new Date(Date.now() - 90 * 86400000).toISOString()),
  ]);
  for (const result of [leads, subscriptions, invoices, events]) if (result.error) throw result.error;
  const leadRows = leads.data ?? [];
  const trials = (subscriptions.data ?? []).filter((item) => item.status === "trial").length;
  const active = (subscriptions.data ?? []).filter((item) => item.status === "active").length;
  const conversions = leadRows.filter((item) => item.status === "converted").length;
  const revenueCents = (invoices.data ?? [])
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.total_cents, 0);
  return {
    leads: leadRows,
    events: events.data ?? [],
    metrics: {
      prospects: leadRows.length,
      trials,
      conversions,
      conversionRate: leadRows.length ? Math.round((conversions / leadRows.length) * 1000) / 10 : 0,
      activeCustomers: active,
      revenueCents,
    },
  };
}
