import { getCurrentUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "organization-signatures";
const TAILLE_MAX = 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Dépôt de la signature manuscrite d'une organisation, dans un bucket PRIVÉ.
 *
 * Une signature est une donnée sensible et réutilisable : aucune URL publique. L'écran
 * l'affiche via une URL signée à durée courte, renvoyée ici après le dépôt.
 */
export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });

  const form = await request.formData();
  const organizationId = form.get("organizationId");
  const fichier = form.get("file");
  if (typeof organizationId !== "string" || !(fichier instanceof File)) {
    return Response.json({ message: "Fichier ou organisation manquant." }, { status: 400 });
  }
  if (!TYPES.has(fichier.type)) {
    return Response.json({ message: "Format accepté : PNG, JPEG ou WebP." }, { status: 400 });
  }
  if (fichier.size > TAILLE_MAX) {
    return Response.json({ message: "La signature ne doit pas dépasser 1 Mo." }, { status: 400 });
  }

  const supabase = await createClient();
  const extension = fichier.type === "image/png" ? "png" : fichier.type === "image/webp" ? "webp" : "jpg";
  const chemin = `${organizationId}/signature-${Date.now()}.${extension}`;

  const upload = await supabase.storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type });
  if (upload.error) {
    return Response.json({ message: `Dépôt refusé : ${upload.error.message}` }, { status: 403 });
  }

  const enregistre = await supabase
    .from("organization_branding" as never)
    .upsert({ organization_id: organizationId, signature_path: chemin } as never, { onConflict: "organization_id" })
    .select("id");
  if (enregistre.error) {
    return Response.json({ message: enregistre.error.message }, { status: 403 });
  }
  if (!enregistre.data?.length) {
    return Response.json({ message: "Signature déposée mais non rattachée à l organisation." }, { status: 403 });
  }

  // URL signée courte, uniquement pour l'aperçu dans l'écran (le bucket reste privé).
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 600);
  return Response.json({ signature_url: data?.signedUrl ?? null });
}

export async function DELETE(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!organizationId) return Response.json({ message: "Organisation manquante." }, { status: 400 });

  const supabase = await createClient();
  const actuel = await supabase
    .from("organization_branding" as never)
    .select("signature_path")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (actuel.error) return Response.json({ message: actuel.error.message }, { status: 403 });

  const chemin = (actuel.data as { signature_path?: string | null } | null)?.signature_path;
  if (chemin) await supabase.storage.from(BUCKET).remove([chemin]);

  const efface = await supabase
    .from("organization_branding" as never)
    .update({ signature_path: null } as never)
    .eq("organization_id", organizationId)
    .select("id");
  if (efface.error) return Response.json({ message: efface.error.message }, { status: 403 });
  return Response.json({ removed: true });
}
