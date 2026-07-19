import { requireSuperAdmin } from "./administration-service";

export type IntegrationStage = "nouveau" | "en_cours" | "en_service";

export type IntegrationCase = {
  organization_id: string;
  name: string;
  organization_type: string;
  status: string;
  created_at: string;
  members: number;
  biens: number;
  subscription_status: string | null;
  stage: IntegrationStage;
};

function subscriptionActive(status: string | null) {
  return status ? ["trial", "active", "past_due"].includes(status) : false;
}

/**
 * Suivi de la mise en service des organisations (super admin) : pour chaque org, le nombre de
 * membres, de biens et l'état d'abonnement, avec une étape d'intégration dérivée.
 */
export async function getIntegrationCases(): Promise<IntegrationCase[]> {
  const { supabase } = await requireSuperAdmin();
  const [orgs, members, biens, subscriptions] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name,organization_type,status,created_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("organization_members").select("organization_id").eq("status", "active").is("archived_at", null),
    supabase.from("biens").select("organization_id").is("archived_at", null),
    supabase.from("organization_subscriptions" as never).select("organization_id,status"),
  ]);
  for (const result of [orgs, members, biens, subscriptions]) {
    if (result.error) throw result.error;
  }

  const countBy = (rows: Array<{ organization_id: string }>) => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.organization_id, (map.get(row.organization_id) ?? 0) + 1);
    return map;
  };
  const memberCounts = countBy((members.data ?? []) as Array<{ organization_id: string }>);
  const bienCounts = countBy((biens.data ?? []) as Array<{ organization_id: string }>);
  const subStatus = new Map(
    ((subscriptions.data ?? []) as unknown as Array<{ organization_id: string; status: string | null }>).map((row) => [
      row.organization_id,
      row.status,
    ]),
  );

  return (
    (orgs.data ?? []) as unknown as Array<{
      id: string;
      name: string;
      organization_type: string;
      status: string;
      created_at: string;
    }>
  ).map((org) => {
    const memberCount = memberCounts.get(org.id) ?? 0;
    const bienCount = bienCounts.get(org.id) ?? 0;
    const subscription = subStatus.get(org.id) ?? null;
    const ready = memberCount > 0 && bienCount > 0 && subscriptionActive(subscription);
    const started = memberCount > 0 || bienCount > 0 || subscription !== null;
    return {
      organization_id: org.id,
      name: org.name,
      organization_type: org.organization_type,
      status: org.status,
      created_at: org.created_at,
      members: memberCount,
      biens: bienCount,
      subscription_status: subscription,
      stage: ready ? "en_service" : started ? "en_cours" : "nouveau",
    };
  });
}
