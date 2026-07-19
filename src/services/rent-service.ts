import { createClient } from "@/lib/supabase/server";

export type RentPeriodStatus = "attendu" | "recu" | "impaye" | "mise_en_demeure" | "annule";

export type RentPeriodRow = {
  id: string;
  organization_id: string;
  bien_id: string;
  bien_reference: string | null;
  bien_name: string | null;
  tenant_name: string | null;
  period_month: string;
  due_date: string;
  amount_cents: number;
  status: RentPeriodStatus;
  reminder_count: number;
  quittance_status: string;
};

type RentPeriodRecord = {
  id: string;
  organization_id: string;
  bien_id: string;
  tenant_name: string | null;
  period_month: string;
  due_date: string;
  amount_cents: number;
  status: RentPeriodStatus;
  reminder_count: number;
  quittance_status: string;
};

function nowIso() {
  return new Date().toISOString();
}

/** Premier jour du mois (ISO date) à partir d'une date quelconque. */
function firstOfMonth(reference: Date) {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** Loyers visibles par l'utilisateur courant (RLS : gestionnaires du bien + locataire concerné). */
export async function listRentPeriods(): Promise<RentPeriodRow[]> {
  const supabase = await createClient();
  const periods = await supabase
    .from("rent_periods" as never)
    .select(
      "id,organization_id,bien_id,tenant_name,period_month,due_date,amount_cents,status,reminder_count,quittance_status",
    )
    .is("archived_at", null)
    .order("due_date", { ascending: true })
    .limit(300);
  if (periods.error) throw periods.error;
  const records = (periods.data ?? []) as unknown as RentPeriodRecord[];

  const bienIds = [...new Set(records.map((record) => record.bien_id))];
  const biens = await supabase.from("biens").select("id,reference,name").in("id", bienIds);
  if (biens.error) throw biens.error;
  const byBien = new Map(
    ((biens.data ?? []) as Array<{ id: string; reference: string | null; name: string | null }>).map((bien) => [
      bien.id,
      bien,
    ]),
  );

  return records.map((record) => {
    const bien = byBien.get(record.bien_id);
    return {
      id: record.id,
      organization_id: record.organization_id,
      bien_id: record.bien_id,
      bien_reference: bien?.reference ?? null,
      bien_name: bien?.name ?? null,
      tenant_name: record.tenant_name,
      period_month: record.period_month,
      due_date: record.due_date,
      amount_cents: record.amount_cents,
      status: record.status,
      reminder_count: record.reminder_count,
      quittance_status: record.quittance_status,
    };
  });
}

/** Confirme (ou non) la réception d'un loyer. reçu → 'recu' ; non reçu → 'impaye'. */
export async function confirmRent(input: { periodId: string; received: boolean }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");
  const { data, error } = await supabase
    .from("rent_periods" as never)
    .update({
      status: input.received ? "recu" : "impaye",
      confirmed_by: auth.user.id,
      confirmed_at: nowIso(),
      updated_at: nowIso(),
    } as never)
    .eq("id", input.periodId)
    .eq("status", "attendu")
    .select("id,status")
    .single();
  if (error) throw error;
  return data as unknown as { id: string; status: RentPeriodStatus };
}

/**
 * Crée les échéances de loyer du mois pour toutes les locations actives visibles.
 * Idempotent (contrainte d'unicité bien/locataire/mois). Renvoie le nombre créé.
 * En production, déclenché mensuellement par n8n ; ici aussi appelable depuis le tableau de bord.
 */
export async function ensureRentPeriodsForMonth(monthReference?: string): Promise<number> {
  const supabase = await createClient();
  const reference = monthReference ? new Date(monthReference) : new Date();
  const periodMonth = firstOfMonth(reference);
  const dueDate = new Date(`${periodMonth.slice(0, 8)}05`).toISOString().slice(0, 10); // le 5 du mois

  const tenancies = await supabase
    .from("bien_occupants")
    .select("bien_id,profile_id,full_name,biens(id,organization_id,monthly_rent_cents)")
    .eq("occupant_type", "locataire")
    .is("ended_at", null)
    .is("archived_at", null);
  if (tenancies.error) throw tenancies.error;

  type Tenancy = {
    profile_id: string | null;
    full_name: string;
    biens:
      | { id: string; organization_id: string; monthly_rent_cents: number | null }
      | Array<{
          id: string;
          organization_id: string;
          monthly_rent_cents: number | null;
        }>
      | null;
  };

  const rows = ((tenancies.data ?? []) as unknown as Tenancy[]).flatMap((tenancy) => {
    const bien = Array.isArray(tenancy.biens) ? tenancy.biens[0] : tenancy.biens;
    if (!bien) return [];
    return [
      {
        organization_id: bien.organization_id,
        bien_id: bien.id,
        tenant_profile_id: tenancy.profile_id,
        tenant_name: tenancy.full_name,
        period_month: periodMonth,
        due_date: dueDate,
        amount_cents: bien.monthly_rent_cents ?? 0,
      },
    ];
  });
  if (rows.length === 0) return 0;

  // upsert idempotent sur (bien_id, tenant_profile_id, period_month) : ne recrée pas l'existant.
  const inserted = await supabase
    .from("rent_periods" as never)
    .upsert(rows as never, { onConflict: "bien_id,tenant_profile_id,period_month", ignoreDuplicates: true })
    .select("id");
  if (inserted.error) throw inserted.error;
  return (inserted.data ?? []).length;
}
