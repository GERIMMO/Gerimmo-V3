import { createClient } from "@/lib/supabase/server";

export type ReportsData = {
  incidents: {
    total: number;
    last30Days: number;
    byStatus: Array<{ key: string; count: number }>;
    byPriority: Array<{ key: string; count: number }>;
    topCategories: Array<{ key: string; count: number }>;
  };
  rent: {
    month: string;
    counts: { attendu: number; recu: number; impaye: number; mise_en_demeure: number };
    expectedCents: number;
    collectedCents: number;
    recoveryRate: number;
  };
  patrimoine: {
    totalBiens: number;
    occupes: number;
    vacants: number;
    occupancyRate: number;
    monthlyRentCents: number;
  };
  interventions: {
    total: number;
    byStatus: Array<{ key: string; count: number }>;
  };
  truncated: boolean;
};

const FETCH_LIMIT = 2000;

function firstOfMonth(reference: Date) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * Compte les occurrences d'une clé et renvoie un tableau trié (desc), les nulls regroupés.
 * Regroupement insensible à la casse/aux espaces (ex. "Plomberie" et "plomberie" fusionnent).
 */
function tally(values: Array<string | null | undefined>, limit?: number) {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = raw && raw.trim() ? raw.trim().toLowerCase() : "inconnu";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Agrège les indicateurs de rapports pour le périmètre visible par l'utilisateur (RLS).
 * Les listes sont bornées à FETCH_LIMIT lignes ; `truncated` signale si une limite a été atteinte.
 */
export async function getReportsData(): Promise<ReportsData> {
  const supabase = await createClient();
  const monthStart = firstOfMonth(new Date());
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [incidents, rent, biens, tenancies, interventions] = await Promise.all([
    supabase
      .from("incidents")
      .select("id,status,priority,category,created_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT),
    supabase
      .from("rent_periods" as never)
      .select("status,amount_cents")
      .eq("period_month", monthStart)
      .is("archived_at", null)
      .limit(FETCH_LIMIT),
    supabase.from("biens").select("id,monthly_rent_cents").is("archived_at", null).limit(FETCH_LIMIT),
    supabase
      .from("bien_occupants")
      .select("bien_id")
      .eq("occupant_type", "locataire")
      .is("ended_at", null)
      .is("archived_at", null)
      .limit(FETCH_LIMIT),
    supabase.from("incident_interventions").select("status").is("archived_at", null).limit(FETCH_LIMIT),
  ]);

  for (const result of [incidents, rent, biens, tenancies, interventions]) {
    if (result.error) throw result.error;
  }

  const incidentRows = (incidents.data ?? []) as Array<{
    status: string | null;
    priority: string | null;
    category: string | null;
    created_at: string;
  }>;
  const rentRows = (rent.data ?? []) as unknown as Array<{ status: string; amount_cents: number }>;
  const bienRows = (biens.data ?? []) as Array<{ id: string; monthly_rent_cents: number | null }>;
  const tenancyRows = (tenancies.data ?? []) as Array<{ bien_id: string }>;
  const interventionRows = (interventions.data ?? []) as Array<{ status: string | null }>;

  const rentCounts = { attendu: 0, recu: 0, impaye: 0, mise_en_demeure: 0 };
  let expectedCents = 0;
  let collectedCents = 0;
  for (const row of rentRows) {
    expectedCents += row.amount_cents;
    if (row.status === "recu") collectedCents += row.amount_cents;
    if (row.status in rentCounts) rentCounts[row.status as keyof typeof rentCounts] += 1;
  }

  const occupiedBienIds = new Set(tenancyRows.map((row) => row.bien_id));
  const totalBiens = bienRows.length;
  const occupes = bienRows.filter((bien) => occupiedBienIds.has(bien.id)).length;
  const monthlyRentCents = bienRows.reduce((sum, bien) => sum + (bien.monthly_rent_cents ?? 0), 0);

  return {
    incidents: {
      total: incidentRows.length,
      last30Days: incidentRows.filter((row) => row.created_at >= since30).length,
      byStatus: tally(incidentRows.map((row) => row.status)),
      byPriority: tally(incidentRows.map((row) => row.priority)),
      topCategories: tally(
        incidentRows.map((row) => row.category),
        6,
      ),
    },
    rent: {
      month: monthStart,
      counts: rentCounts,
      expectedCents,
      collectedCents,
      recoveryRate: expectedCents > 0 ? Math.round((collectedCents / expectedCents) * 100) : 0,
    },
    patrimoine: {
      totalBiens,
      occupes,
      vacants: Math.max(0, totalBiens - occupes),
      occupancyRate: totalBiens > 0 ? Math.round((occupes / totalBiens) * 100) : 0,
      monthlyRentCents,
    },
    interventions: {
      total: interventionRows.length,
      byStatus: tally(interventionRows.map((row) => row.status)),
    },
    truncated: [incidentRows, rentRows, bienRows, tenancyRows, interventionRows].some(
      (rows) => rows.length >= FETCH_LIMIT,
    ),
  };
}
