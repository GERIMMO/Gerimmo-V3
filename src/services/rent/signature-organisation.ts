import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "organization-signatures";

/**
 * Récupère la signature manuscrite d'une organisation, prête à être incrustée dans un PDF.
 *
 * La signature vit dans un bucket PRIVÉ : on ne peut pas la lire par une simple URL comme le
 * logo. On lit son chemin dans organization_branding puis on télécharge les octets via le
 * client d'administration. Renvoie `null` si aucune signature n'est déposée, ou si le
 * téléchargement échoue — un document se signe à la main après impression, le cas échéant.
 */
export async function chargerSignatureOrganisation(organizationId: string): Promise<Uint8Array | null> {
  const admin = createAdminClient();
  const branding = await admin
    .from("organization_branding")
    .select("signature_path")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (branding.error) throw branding.error;

  const chemin = (branding.data as { signature_path?: string | null } | null)?.signature_path;
  if (!chemin) return null;

  const fichier = await admin.storage.from(BUCKET).download(chemin);
  if (fichier.error || !fichier.data) return null;
  return new Uint8Array(await fichier.data.arrayBuffer());
}
