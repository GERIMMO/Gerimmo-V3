import { buildQuittancePdf } from "@/lib/pdf/quittance";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Génère le fichier PDF d'une quittance et le dépose dans le stockage.
 *
 * Le dépôt passe par le client d'administration : produire un document officiel est une
 * opération serveur, déclenchée après que les droits de l'utilisateur ont déjà été vérifiés
 * sur l'échéance elle-même.
 */

const BUCKET = "documents";

export type QuittanceContexte = {
  periodId: string;
  organizationId: string;
  bienId: string;
  tenantName: string | null;
  periodMonth: string;
  rentCents: number;
  chargesCents: number;
  dateReglement: Date;
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

function jourMois(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function libelleMois(periodMonth: string) {
  return new Date(periodMonth).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Renvoie le fichier généré (octets + chemin), ou `null` si le PDF n'a pas pu être produit.
 * L'appelant décide alors quoi faire : la quittance reste valable en tant que document, mais
 * sans pièce jointe — on ne bloque pas l'encaissement d'un loyer pour un souci de mise en page.
 */
export async function genererQuittancePdf(contexte: QuittanceContexte) {
  const admin = createAdminClient();

  const [organisation, bien] = await Promise.all([
    admin
      .from("organizations")
      .select("name,legal_name,siren,address_line1,address_line2,postal_code,city")
      .eq("id", contexte.organizationId)
      .maybeSingle(),
    admin.from("biens").select("address_line1,postal_code,city,name,reference").eq("id", contexte.bienId).maybeSingle(),
  ]);
  if (organisation.error) throw organisation.error;
  if (bien.error) throw bien.error;

  const debut = new Date(contexte.periodMonth);
  const fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 0);
  // Un logement sans adresse renseignée ne doit pas produire une quittance muette : on
  // retombe sur son nom ou sa référence, faute de mieux, et cela se voit.
  const adresseLogement = bien.data ? lignesAdresse(bien.data) : [];
  const logement =
    adresseLogement.length > 0 ? adresseLogement : [bien.data?.name ?? bien.data?.reference ?? "Logement"];

  const octets = await buildQuittancePdf({
    reference: contexte.reference,
    bailleur: {
      nom: organisation.data?.legal_name ?? organisation.data?.name ?? "Le bailleur",
      adresse: organisation.data ? lignesAdresse(organisation.data) : [],
      siren: organisation.data?.siren ?? null,
    },
    locataire: { nom: contexte.tenantName ?? "Le locataire", adresse: logement },
    logement,
    periodeLabel: libelleMois(contexte.periodMonth),
    periodeDebut: jourMois(debut),
    periodeFin: jourMois(fin),
    loyerCents: contexte.rentCents,
    chargesCents: contexte.chargesCents,
    dateReglement: jourMois(contexte.dateReglement),
    lieuEtDate: `Fait le ${jourMois(new Date())}`,
  });

  const upload = await admin.storage.from(BUCKET).upload(contexte.storagePath, octets, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upload.error) throw upload.error;

  return { octets, storagePath: contexte.storagePath, taille: octets.byteLength };
}

/** Télécharge un document stocké, pour le joindre à un e-mail. */
export async function telechargerDocument(storagePath: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(storagePath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
