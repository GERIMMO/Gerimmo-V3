import { getCurrentUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "organization-logos";
const TAILLE_MAX = 2 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Dépôt du logo d'une organisation.
 *
 * L'upload passe par la session de l'utilisateur : la RLS du bucket vérifie qu'il gère bien
 * l'organisation (`can_manage_organization`). Le logo est public en lecture, il sert au bot,
 * aux e-mails et à l'en-tête des documents.
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
    return Response.json({ message: "Le logo ne doit pas dépasser 2 Mo." }, { status: 400 });
  }

  const supabase = await createClient();
  const extension = fichier.type === "image/png" ? "png" : fichier.type === "image/webp" ? "webp" : "jpg";
  // Nom horodaté : le cache d'un ancien logo ne masque pas le nouveau, et l'URL change.
  const chemin = `${organizationId}/logo-${Date.now()}.${extension}`;

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(chemin, fichier, { contentType: fichier.type, upsert: true });
  if (upload.error) {
    return Response.json({ message: `Dépôt refusé : ${upload.error.message}` }, { status: 403 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(chemin);

  // On enregistre l'URL dans le branding, en réutilisant le contrôle de droits existant.
  const enregistre = await supabase
    .from("organization_branding" as never)
    .upsert({ organization_id: organizationId, logo_url: data.publicUrl } as never, { onConflict: "organization_id" })
    .select("id");
  if (enregistre.error) {
    return Response.json({ message: enregistre.error.message }, { status: 403 });
  }
  if (!enregistre.data?.length) {
    return Response.json({ message: "Logo déposé mais non rattaché à l organisation." }, { status: 403 });
  }

  return Response.json({ logo_url: data.publicUrl });
}
