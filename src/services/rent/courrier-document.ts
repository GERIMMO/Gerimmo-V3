import { buildMiseEnDemeurePdf } from "@/lib/pdf/mise-en-demeure";
import { buildRelancePdf } from "@/lib/pdf/relance-loyer";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargerLogoOrganisation } from "@/services/rent/logo-organisation";

/**
 * Génère et stocke le courrier PDF d'une relance ou d'une mise en demeure.
 *
 * Les trois niveaux partagent les mêmes données (parties, logement, échéances impayées) :
 * seul le document produit change.
 */

const BUCKET = "documents";
/** Délai laissé au locataire pour régulariser, en jours. */
export const DELAI_REGULARISATION_JOURS = 8;

export type ContexteCourrier = {
  organizationId: string;
  bienId: string;
  tenantName: string | null;
  /** Échéances impayées, de la plus ancienne à la plus récente. */
  echeances: Array<{ periodMonth: string; dueDate: string; montantCents: number }>;
  /** Dates des relances déjà adressées, au format jj/mm/aaaa. */
  relancesLe: string[];
  reference: string;
  storagePath: string;
};

function lignesAdresse(source: {
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
}) {
  const codeEtVille = [source.postal_code, source.city].filter(Boolean).join(" ");
  return [source.address_line1, source.address_line2, codeEtVille].filter((ligne): ligne is string => Boolean(ligne));
}

export function jourMois(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function libelleMois(periodMonth: string) {
  return new Date(periodMonth).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Parties et logement, tels qu'ils doivent apparaître en tête de courrier. */
async function chargerParties(admin: ReturnType<typeof createAdminClient>, contexte: ContexteCourrier) {
  const [organisation, bien, logo] = await Promise.all([
    admin
      .from("organizations")
      .select("name,legal_name,siren,address_line1,address_line2,postal_code,city")
      .eq("id", contexte.organizationId)
      .maybeSingle(),
    admin.from("biens").select("address_line1,postal_code,city,name,reference").eq("id", contexte.bienId).maybeSingle(),
    chargerLogoOrganisation(contexte.organizationId),
  ]);
  if (organisation.error) throw organisation.error;
  if (bien.error) throw bien.error;

  const adresseLogement = bien.data ? lignesAdresse(bien.data) : [];
  // Un logement sans adresse ne doit pas produire un courrier muet : on retombe sur son nom
  // ou sa référence, faute de mieux, et cela se voit.
  const logement =
    adresseLogement.length > 0 ? adresseLogement : [bien.data?.name ?? bien.data?.reference ?? "Logement"];

  return {
    bailleur: {
      nom: organisation.data?.legal_name ?? organisation.data?.name ?? "Le bailleur",
      adresse: organisation.data ? lignesAdresse(organisation.data) : [],
      siren: organisation.data?.siren ?? null,
    },
    locataire: { nom: contexte.tenantName ?? "Le locataire", adresse: logement },
    logement,
    logo,
  };
}

/**
 * Produit le PDF correspondant au niveau (1re relance, 2e relance, mise en demeure) et le
 * dépose dans le stockage. Renvoie le chemin et la taille, pour les enregistrer sur le
 * document.
 */
export async function genererCourrierImpaye(
  niveau: 1 | 2 | "mise_en_demeure",
  contexte: ContexteCourrier,
): Promise<{ storagePath: string; taille: number }> {
  const admin = createAdminClient();
  const parties = await chargerParties(admin, contexte);

  const echeances = contexte.echeances.map((echeance) => ({
    periodeLabel: libelleMois(echeance.periodMonth),
    echeanceLe: jourMois(new Date(echeance.dueDate)),
    montantCents: echeance.montantCents,
  }));
  const lieuEtDate = `Fait le ${jourMois(new Date())}`;

  const octets =
    niveau === "mise_en_demeure"
      ? await buildMiseEnDemeurePdf({
          reference: contexte.reference,
          ...parties,
          echeances,
          relancesLe: contexte.relancesLe,
          delaiJours: DELAI_REGULARISATION_JOURS,
          lieuEtDate,
        })
      : await buildRelancePdf({
          niveau,
          reference: contexte.reference,
          ...parties,
          echeances,
          relancePrecedenteLe: contexte.relancesLe.at(-1) ?? null,
          delaiJours: DELAI_REGULARISATION_JOURS,
          lieuEtDate,
        });

  const upload = await admin.storage.from(BUCKET).upload(contexte.storagePath, octets, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upload.error) throw upload.error;

  return { storagePath: contexte.storagePath, taille: octets.byteLength };
}

/**
 * Contact de l'agence ou du propriétaire, à prévenir quand une mise en demeure est émise.
 *
 * Une mise en demeure envoyée par e-mail a une valeur probatoire faible : c'est un humain
 * qui doit l'expédier en recommandé. Sans cette alerte, personne ne saurait qu'il faut agir.
 */
export async function contactGestionnaire(organizationId: string) {
  const admin = createAdminClient();
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
  const profil = (data as { profiles?: { email?: string | null; full_name?: string | null } | null } | null)?.profiles;
  return profil?.email ? { email: profil.email, nom: profil.full_name ?? "" } : null;
}
