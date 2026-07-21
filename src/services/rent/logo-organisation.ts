import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Récupère le logo d'une organisation, prêt à être incrusté dans un PDF.
 *
 * Le logo est stocké en public (bucket organization-logos) et son URL est enregistrée dans
 * organization_branding. On lit l'URL puis on télécharge les octets. Renvoie `null` si aucun
 * logo, ou si le téléchargement échoue — un logo indisponible ne doit jamais empêcher
 * l'émission d'un document.
 */
export async function chargerLogoOrganisation(organizationId: string): Promise<Uint8Array | null> {
  const admin = createAdminClient();
  const branding = await admin
    .from("organization_branding")
    .select("logo_url,branding_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (branding.error) throw branding.error;

  // Le logo n'habille les documents que si l'agence a activé sa personnalisation.
  const url = branding.data?.branding_enabled ? branding.data.logo_url : null;
  if (!url) return null;

  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    return new Uint8Array(await reponse.arrayBuffer());
  } catch {
    return null;
  }
}
