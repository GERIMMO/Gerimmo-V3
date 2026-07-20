import { createClient } from "@/lib/supabase/server";

type UserClient = Awaited<ReturnType<typeof createClient>>;

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

type ConfirmedPeriod = {
  id: string;
  organization_id: string;
  bien_id: string;
  tenant_profile_id: string | null;
  tenant_name: string | null;
  amount_cents: number;
  period_month: string;
  status: RentPeriodStatus;
};

/**
 * Confirme (ou non) la réception d'un loyer. reçu → 'recu' + génération de la quittance
 * (brouillon, à valider) ; non reçu → 'impaye' (entre dans le cycle de relances).
 */
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
    .select("id,organization_id,bien_id,tenant_profile_id,tenant_name,amount_cents,period_month,status")
    .single();
  if (error) throw error;
  const period = data as unknown as ConfirmedPeriod;

  if (input.received) {
    await generateQuittanceForPeriod(supabase, period);
  }
  return { id: period.id, status: period.status };
}

function monthLabel(periodMonth: string) {
  return new Date(periodMonth).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Crée la quittance (document type 'quittance', visible locataire, en brouillon) et la relie
 * à la période. Créée sous le compte du gestionnaire (RLS can_manage_documents couvre admin,
 * agent et propriétaire). La quittance devra être validée humainement.
 */
async function generateQuittanceForPeriod(supabase: UserClient, period: ConfirmedPeriod) {
  const document = await supabase
    .from("documents")
    .insert({
      organization_id: period.organization_id,
      bien_id: period.bien_id,
      tenant_profile_id: period.tenant_profile_id,
      title: `Quittance de loyer - ${monthLabel(period.period_month)}`,
      reference: `QUIT-${period.period_month.replace(/-/g, "").slice(0, 6)}-${period.id.slice(0, 8)}`,
      document_type: "quittance",
      status: "brouillon",
      visibility: "locataire",
      mime_type: "application/pdf",
      metadata: {
        rent_period_id: period.id,
        amount_cents: period.amount_cents,
        period_month: period.period_month,
        tenant_name: period.tenant_name,
      },
    } as never)
    .select("id")
    .single();
  if (document.error) throw document.error;
  const documentId = (document.data as unknown as { id: string }).id;

  // Sans .select(), un refus de la RLS ne touche aucune ligne SANS lever d'erreur : la
  // quittance existerait alors en base sans être rattachée à la période, donc introuvable
  // (validateQuittance répondrait « Aucune quittance à valider » alors qu'elle existe).
  const linked = await supabase
    .from("rent_periods" as never)
    .update({ quittance_document_id: documentId, quittance_status: "a_valider", updated_at: nowIso() } as never)
    .eq("id", period.id)
    .select("id");
  if (linked.error) throw linked.error;
  if (!linked.data?.length) {
    throw new Error("Quittance generee mais impossible de la rattacher au loyer.");
  }
}

/**
 * Valide la quittance : rend le document actif (visible au locataire) et prépare l'envoi e-mail
 * (file document_email_outbox, consommée par n8n). 'envoyee' si un e-mail a pu être mis en file,
 * sinon 'validee' (document tout de même disponible).
 */
export async function validateQuittance(input: { periodId: string }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");

  const periodResult = await supabase
    .from("rent_periods" as never)
    .select("id,organization_id,tenant_profile_id,quittance_document_id,quittance_status,period_month")
    .eq("id", input.periodId)
    .maybeSingle();
  if (periodResult.error) throw periodResult.error;
  const period = periodResult.data as unknown as {
    id: string;
    organization_id: string;
    tenant_profile_id: string | null;
    quittance_document_id: string | null;
    quittance_status: string;
    period_month: string;
  } | null;
  if (!period || period.quittance_status !== "a_valider" || !period.quittance_document_id) {
    throw new Error("Aucune quittance à valider pour ce loyer.");
  }

  // Le document DOIT devenir actif : c'est ce qui le rend visible au locataire. Un refus
  // silencieux le laisserait en brouillon pendant qu'on annonce la quittance envoyée — le
  // locataire recevrait un e-mail renvoyant vers un espace où il n'y a rien.
  const documentUpdate = await supabase
    .from("documents")
    .update({ status: "actif" } as never)
    .eq("id", period.quittance_document_id)
    .select("id");
  if (documentUpdate.error) throw documentUpdate.error;
  if (!documentUpdate.data?.length) {
    throw new Error("Impossible d activer la quittance : elle resterait invisible au locataire.");
  }

  let emailed = false;
  if (period.tenant_profile_id) {
    const profile = await supabase.from("profiles").select("email").eq("id", period.tenant_profile_id).maybeSingle();
    // Le profil du locataire doit être lisible ; s'il ne l'est pas, on échoue plutôt que de
    // sauter l'envoi en silence (c'était le bug : quittance « validée », jamais reçue).
    if (profile.error) throw profile.error;
    if (!profile.data) {
      throw new Error("Profil du locataire introuvable : quittance non envoyee.");
    }
    const email = profile.data?.email as string | null | undefined;
    // Un locataire sans adresse e-mail est un cas métier normal (remise papier) : la
    // quittance reste disponible dans son espace et le statut final le reflète ('validee').
    if (email) {
      const outbox = await supabase.from("document_email_outbox").insert({
        organization_id: period.organization_id,
        document_id: period.quittance_document_id,
        recipient_email: email,
        subject: `Votre quittance de loyer - ${monthLabel(period.period_month)}`,
        body: "Bonjour,\n\nVeuillez trouver votre quittance de loyer. Elle est aussi disponible dans votre espace GERIMMO.",
        status: "pret",
      } as never);
      if (outbox.error) throw outbox.error;
      emailed = true;
    }
  }

  const finalStatus = emailed ? "envoyee" : "validee";
  const periodUpdate = await supabase
    .from("rent_periods" as never)
    .update({
      quittance_status: finalStatus,
      quittance_validated_by: auth.user.id,
      quittance_validated_at: nowIso(),
      updated_at: nowIso(),
    } as never)
    .eq("id", input.periodId)
    .select("id");
  if (periodUpdate.error) throw periodUpdate.error;
  if (!periodUpdate.data?.length) {
    throw new Error("Statut de la quittance non enregistre.");
  }
  return { periodId: input.periodId, quittance_status: finalStatus, emailed };
}

/** Met en file un e-mail lié à un document, si le locataire a une adresse. Renvoie true si mis en file. */
async function queueTenantEmail(
  supabase: UserClient,
  input: { organizationId: string; documentId: string; tenantProfileId: string | null; subject: string; body: string },
) {
  if (!input.tenantProfileId) return false;
  const profile = await supabase.from("profiles").select("email").eq("id", input.tenantProfileId).maybeSingle();
  // Un profil illisible (erreur, ou RLS qui renvoie 0 ligne) n'est PAS la même chose qu'un
  // locataire sans e-mail : le premier est une panne, le second un cas métier. Confondre les
  // deux faisait sauter l'envoi en silence — un locataire pouvait être mis en demeure sans
  // avoir reçu la moindre relance.
  if (profile.error) throw profile.error;
  if (!profile.data) {
    throw new Error("Profil du locataire introuvable : courrier non envoye.");
  }
  const email = profile.data?.email as string | null | undefined;
  if (!email) return false;
  const outbox = await supabase.from("document_email_outbox").insert({
    organization_id: input.organizationId,
    document_id: input.documentId,
    recipient_email: email,
    subject: input.subject,
    body: input.body,
    status: "pret",
  } as never);
  if (outbox.error) throw outbox.error;
  return true;
}

type ImpayePeriod = {
  id: string;
  organization_id: string;
  bien_id: string;
  tenant_profile_id: string | null;
  period_month: string;
  status: RentPeriodStatus;
  reminder_count: number;
};

/**
 * Relance un loyer impayé : crée un courrier (disponible au locataire) + e-mail.
 * Après 2 relances, la relance suivante devient une mise en demeure (statut mise_en_demeure).
 * Idempotence côté déclencheur (n8n) : n'agit que sur les périodes 'impaye'.
 */
export async function sendRentReminder(input: { periodId: string }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");

  const result = await supabase
    .from("rent_periods" as never)
    .select("id,organization_id,bien_id,tenant_profile_id,period_month,status,reminder_count")
    .eq("id", input.periodId)
    .maybeSingle();
  if (result.error) throw result.error;
  const period = result.data as unknown as ImpayePeriod | null;
  if (!period || period.status !== "impaye") {
    throw new Error("Ce loyer n'est pas en impayé.");
  }

  const isMiseEnDemeure = period.reminder_count >= 2;
  const nextNumber = period.reminder_count + 1;
  const label = monthLabel(period.period_month);
  const title = isMiseEnDemeure ? `Mise en demeure - loyer ${label}` : `Relance ${nextNumber} - loyer ${label}`;
  const prefix = isMiseEnDemeure ? "MED" : "REL";

  const document = await supabase
    .from("documents")
    .insert({
      organization_id: period.organization_id,
      bien_id: period.bien_id,
      tenant_profile_id: period.tenant_profile_id,
      title,
      reference: `${prefix}-${period.period_month.replace(/-/g, "").slice(0, 6)}-${period.id.slice(0, 8)}-${nextNumber}`,
      document_type: "courrier",
      status: "actif",
      visibility: "locataire",
      mime_type: "application/pdf",
      metadata: {
        rent_period_id: period.id,
        kind: isMiseEnDemeure ? "mise_en_demeure" : "relance",
        reminder_number: nextNumber,
      },
    } as never)
    .select("id")
    .single();
  if (document.error) throw document.error;
  const documentId = (document.data as unknown as { id: string }).id;

  const emailed = await queueTenantEmail(supabase, {
    organizationId: period.organization_id,
    documentId,
    tenantProfileId: period.tenant_profile_id,
    subject: isMiseEnDemeure ? `Mise en demeure - loyer ${label}` : `Relance loyer ${label}`,
    body: isMiseEnDemeure
      ? "Bonjour,\n\nMalgré nos relances, votre loyer reste impayé. Vous êtes mis en demeure de régulariser votre situation. Ce courrier est disponible dans votre espace GERIMMO."
      : "Bonjour,\n\nSauf erreur de notre part, votre loyer n'a pas été réglé. Merci de régulariser rapidement. Ce courrier est disponible dans votre espace GERIMMO.",
  });

  const periodUpdate = await supabase
    .from("rent_periods" as never)
    .update(
      (isMiseEnDemeure
        ? { status: "mise_en_demeure", mise_en_demeure_at: nowIso(), last_reminder_at: nowIso(), updated_at: nowIso() }
        : { reminder_count: nextNumber, last_reminder_at: nowIso(), updated_at: nowIso() }) as never,
    )
    .eq("id", input.periodId)
    .select("id");
  if (periodUpdate.error) throw periodUpdate.error;
  // Sans ce contrôle, un refus silencieux laissait reminder_count inchangé : le locataire
  // recevait « Relance 1 » indéfiniment et l'escalade en mise en demeure n'arrivait jamais.
  if (!periodUpdate.data?.length) {
    throw new Error("Courrier genere mais suivi de relance non enregistre.");
  }

  return { periodId: input.periodId, miseEnDemeure: isMiseEnDemeure, reminderNumber: nextNumber, emailed };
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
