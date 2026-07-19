import { listArtisanValidations, setArtisanValidation } from "@/services/artisan-validation-service";

// Accès garanti par requireSuperAdmin() dans le service + RLS is_super_admin().
export async function GET() {
  try {
    return Response.json({ artisans: await listArtisanValidations() });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Chargement impossible." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { profileId?: string; status?: string; notes?: string };
    if (!body.profileId || !body.status || !["en_attente", "valide", "refuse"].includes(body.status)) {
      return Response.json({ message: "Profil et statut valides requis." }, { status: 400 });
    }
    const updated = await setArtisanValidation({
      profileId: body.profileId,
      status: body.status as "en_attente" | "valide" | "refuse",
      notes: body.notes,
    });
    return Response.json(updated);
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Mise à jour impossible." },
      { status: 400 },
    );
  }
}
