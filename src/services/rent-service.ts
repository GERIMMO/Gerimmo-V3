import { objetMiseEnDemeure } from "@/lib/pdf/mise-en-demeure";
import { objetRelance } from "@/lib/pdf/relance-loyer";
import { createClient } from "@/lib/supabase/server";
import { contactGestionnaire, genererCourrierImpaye, jourMois } from "@/services/rent/courrier-document";
import { genererQuittancePdf } from "@/services/rent/quittance-document";
import { chargerSignatureOrganisation } from "@/services/rent/signature-organisation";

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

/**
 * Organisations visibles disposant d'une signature manuscrite déposée. Sert à n'afficher le
 * bouton « Signer et valider » que là où une signature existe réellement.
 */
export async function listSignableOrganizations(): Promise<string[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("organization_branding" as never)
    .select("organization_id,signature_path")
    .not("signature_path", "is", null)
    .is("archived_at", null);
  if (result.error) throw result.error;
  return ((result.data ?? []) as unknown as Array<{ organization_id: string }>).map((row) => row.organization_id);
}

type ConfirmedPeriod = {
  id: string;
  organization_id: string;
  bien_id: string;
  tenant_profile_id: string | null;
  tenant_name: string | null;
  amount_cents: number;
  /** Loyer hors charges. Les échéances antérieures au détail portent le total ici. */
  rent_cents: number | null;
  charges_cents: number;
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
    .select(
      "id,organization_id,bien_id,tenant_profile_id,tenant_name,amount_cents,rent_cents,charges_cents,period_month,status",
    )
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

  // Produire le fichier PDF et le déposer dans le stockage. Jusqu'ici la quittance annonçait
  // un PDF (mime_type, chemin) qui n'existait pas : le locataire ne téléchargeait rien.
  const reference = `QUIT-${period.period_month.replace(/-/g, "").slice(0, 6)}-${period.id.slice(0, 8)}`;
  const storagePath = `quittances/${period.organization_id}/${reference}.pdf`;
  const fichier = await genererQuittancePdf({
    periodId: period.id,
    organizationId: period.organization_id,
    bienId: period.bien_id,
    tenantName: period.tenant_name,
    periodMonth: period.period_month,
    // Les échéances créées avant le détail loyer/charges n'ont que le total : il est alors
    // porté par le loyer, jamais inventé en charges.
    rentCents: period.rent_cents ?? period.amount_cents,
    chargesCents: period.charges_cents,
    dateReglement: new Date(),
    reference,
    storagePath,
  });

  const fichierEnregistre = await supabase
    .from("documents")
    .update({
      storage_path: fichier.storagePath,
      file_name: `${reference}.pdf`,
      file_size_bytes: fichier.taille,
    } as never)
    .eq("id", documentId)
    .select("id");
  if (fichierEnregistre.error) throw fichierEnregistre.error;
  if (!fichierEnregistre.data?.length) {
    throw new Error("Quittance generee mais le fichier n a pas pu etre rattache au document.");
  }

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
 * Régénère le PDF d'une quittance avec la signature manuscrite de l'organisation, au même
 * emplacement de stockage (le document et son lien ne changent pas, seul le fichier est
 * remplacé). Échoue si aucune signature n'est déposée : signer était un choix explicite, on ne
 * le transforme pas en quittance vierge sans le dire.
 */
async function signQuittanceForPeriod(
  supabase: UserClient,
  period: {
    id: string;
    organization_id: string;
    bien_id: string;
    tenant_name: string | null;
    amount_cents: number;
    rent_cents: number | null;
    charges_cents: number;
    period_month: string;
    quittance_document_id: string | null;
  },
) {
  if (!period.quittance_document_id) throw new Error("Quittance introuvable : rien à signer.");

  const signature = await chargerSignatureOrganisation(period.organization_id);
  if (!signature) {
    throw new Error("Aucune signature enregistrée : déposez-la dans Paramètres › Identité avant de signer.");
  }

  // On réutilise le chemin et la référence déjà portés par le document : le fichier signé
  // remplace l'ancien (upsert), sans créer de doublon ni casser le lien avec la période.
  const document = await supabase
    .from("documents")
    .select("storage_path,reference")
    .eq("id", period.quittance_document_id)
    .maybeSingle();
  if (document.error) throw document.error;
  const infos = document.data as unknown as { storage_path: string | null; reference: string | null } | null;
  if (!infos?.storage_path) throw new Error("Le fichier de la quittance est introuvable : signature impossible.");

  const reference =
    infos.reference ?? `QUIT-${period.period_month.replace(/-/g, "").slice(0, 6)}-${period.id.slice(0, 8)}`;
  const fichier = await genererQuittancePdf({
    periodId: period.id,
    organizationId: period.organization_id,
    bienId: period.bien_id,
    tenantName: period.tenant_name,
    periodMonth: period.period_month,
    rentCents: period.rent_cents ?? period.amount_cents,
    chargesCents: period.charges_cents,
    dateReglement: new Date(),
    reference,
    storagePath: infos.storage_path,
    signer: true,
  });

  const enregistre = await supabase
    .from("documents")
    .update({ file_size_bytes: fichier.taille } as never)
    .eq("id", period.quittance_document_id)
    .select("id");
  if (enregistre.error) throw enregistre.error;
  if (!enregistre.data?.length) {
    throw new Error("Quittance signée mais la mise à jour du document a échoué.");
  }
}

/**
 * Valide la quittance : rend le document actif (visible au locataire) et prépare l'envoi e-mail
 * (file document_email_outbox, consommée par n8n). 'envoyee' si un e-mail a pu être mis en file,
 * sinon 'validee' (document tout de même disponible).
 */
export async function validateQuittance(input: { periodId: string; sign?: boolean }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");

  const periodResult = await supabase
    .from("rent_periods" as never)
    .select(
      "id,organization_id,bien_id,tenant_profile_id,tenant_name,amount_cents,rent_cents,charges_cents,quittance_document_id,quittance_status,period_month",
    )
    .eq("id", input.periodId)
    .maybeSingle();
  if (periodResult.error) throw periodResult.error;
  const period = periodResult.data as unknown as {
    id: string;
    organization_id: string;
    bien_id: string;
    tenant_profile_id: string | null;
    tenant_name: string | null;
    amount_cents: number;
    rent_cents: number | null;
    charges_cents: number;
    quittance_document_id: string | null;
    quittance_status: string;
    period_month: string;
  } | null;
  if (!period || period.quittance_status !== "a_valider" || !period.quittance_document_id) {
    throw new Error("Aucune quittance à valider pour ce loyer.");
  }

  // Signature à la demande, document par document : on régénère le PDF au même emplacement,
  // cette fois avec la signature manuscrite incrustée. Refusé s'il n'y a pas de signature
  // déposée, plutôt que de valider en silence une quittance restée vierge.
  if (input.sign) {
    await signQuittanceForPeriod(supabase, period);
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
  tenant_name?: string | null;
  period_month: string;
  due_date: string;
  amount_cents: number;
  status: RentPeriodStatus;
  reminder_count: number;
  last_reminder_at: string | null;
};

/**
 * Relance un loyer impayé : crée un courrier (disponible au locataire) + e-mail.
 * Après 2 relances, la relance suivante devient une mise en demeure (statut mise_en_demeure).
 * Idempotence côté déclencheur (n8n) : n'agit que sur les périodes 'impaye'.
 */
export async function sendRentReminder(input: { periodId: string; sign?: boolean }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");

  const result = await supabase
    .from("rent_periods" as never)
    .select(
      "id,organization_id,bien_id,tenant_profile_id,period_month,due_date,amount_cents,status,reminder_count,last_reminder_at",
    )
    .eq("id", input.periodId)
    .maybeSingle();
  if (result.error) throw result.error;
  const period = result.data as unknown as ImpayePeriod | null;
  if (!period || period.status !== "impaye") {
    throw new Error("Ce loyer n'est pas en impayé.");
  }

  // Signer était un choix explicite : on refuse plutôt que d'émettre un courrier vierge si
  // aucune signature n'est déposée. Le courrier étant produit puis envoyé d'un seul tenant,
  // ce contrôle doit précéder toute génération.
  if (input.sign && !(await chargerSignatureOrganisation(period.organization_id))) {
    throw new Error("Aucune signature enregistrée : déposez-la dans Paramètres › Identité avant de signer.");
  }

  const isMiseEnDemeure = period.reminder_count >= 2;
  const nextNumber = period.reminder_count + 1;
  const label = monthLabel(period.period_month);
  const title = isMiseEnDemeure ? `Mise en demeure - loyer ${label}` : `Relance ${nextNumber} - loyer ${label}`;
  const prefix = isMiseEnDemeure ? "MED" : "REL";

  const reference = `${prefix}-${period.period_month.replace(/-/g, "").slice(0, 6)}-${period.id.slice(0, 8)}-${nextNumber}`;

  const document = await supabase
    .from("documents")
    .insert({
      organization_id: period.organization_id,
      bien_id: period.bien_id,
      tenant_profile_id: period.tenant_profile_id,
      title,
      reference,
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

  // Le courrier PDF : un e-mail seul ne laisse aucune trace du document exact envoyé.
  const fichier = await genererCourrierImpaye(
    isMiseEnDemeure ? "mise_en_demeure" : ((nextNumber === 1 ? 1 : 2) as 1 | 2),
    {
      organizationId: period.organization_id,
      bienId: period.bien_id,
      tenantName: period.tenant_name ?? null,
      echeances: [{ periodMonth: period.period_month, dueDate: period.due_date, montantCents: period.amount_cents }],
      relancesLe: period.last_reminder_at ? [jourMois(new Date(period.last_reminder_at))] : [],
      reference,
      storagePath: `courriers/${period.organization_id}/${reference}.pdf`,
      signer: input.sign === true,
    },
  );

  const fichierEnregistre = await supabase
    .from("documents")
    .update({
      storage_path: fichier.storagePath,
      file_name: `${reference}.pdf`,
      file_size_bytes: fichier.taille,
    } as never)
    .eq("id", documentId)
    .select("id");
  if (fichierEnregistre.error) throw fichierEnregistre.error;
  if (!fichierEnregistre.data?.length) {
    throw new Error("Courrier genere mais le fichier n a pas pu etre rattache au document.");
  }

  const objet = isMiseEnDemeure ? objetMiseEnDemeure(label) : objetRelance(nextNumber === 1 ? 1 : 2, label);
  const emailed = await queueTenantEmail(supabase, {
    organizationId: period.organization_id,
    documentId,
    tenantProfileId: period.tenant_profile_id,
    subject: objet,
    body: isMiseEnDemeure
      ? "Bonjour,\n\nVous trouverez ci-joint une mise en demeure relative au loyer resté impayé malgré nos relances. Elle est également disponible dans votre espace GERIMMO.\n\nSi votre règlement a été effectué entre-temps, merci de nous en informer sans délai."
      : "Bonjour,\n\nVous trouverez ci-joint un courrier relatif au loyer resté impayé à ce jour. Il est également disponible dans votre espace GERIMMO.\n\nSi votre règlement a été effectué entre-temps, merci de ne pas en tenir compte.",
  });

  // Alerte au gestionnaire : la mise en demeure doit partir en recommandé, ce que
  // l'application ne peut pas faire. Sans ce message, personne ne saurait qu'il faut agir.
  if (isMiseEnDemeure) {
    const gestionnaire = await contactGestionnaire(period.organization_id);
    if (gestionnaire) {
      const alerte = await supabase.from("document_email_outbox").insert({
        organization_id: period.organization_id,
        document_id: documentId,
        recipient_email: gestionnaire.email,
        subject: `Action requise : mise en demeure à envoyer en recommandé — ${label}`,
        body:
          `Une mise en demeure vient d'être émise pour le loyer ${label} et adressée par e-mail au locataire.\n\n` +
          "Un e-mail a une valeur de preuve faible : imprimez le courrier ci-joint et envoyez-le en lettre " +
          "recommandée avec accusé de réception. C'est cet envoi qui établira la date de réception.\n\n" +
          "Si le bail comporte une clause résolutoire, l'acte qui ouvre le délai légal de deux mois est un " +
          "commandement de payer délivré par un commissaire de justice.",
        status: "pret",
      } as never);
      if (alerte.error) throw alerte.error;
    }
  }

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
