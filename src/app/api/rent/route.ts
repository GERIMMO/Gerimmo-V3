import { getCurrentUser } from "@/lib/auth/guards";
import { confirmRent, ensureRentPeriodsForMonth, listRentPeriods } from "@/services/rent-service";

// La RLS (can_manage_rent) fait autorité ; la route exige juste une session valide.
export async function GET() {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    return Response.json({ periods: await listRentPeriods() });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Chargement impossible." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    const body = (await request.json()) as { periodId?: string; received?: boolean };
    if (!body.periodId || typeof body.received !== "boolean") {
      return Response.json({ message: "Période et réponse requises." }, { status: 400 });
    }
    return Response.json(await confirmRent({ periodId: body.periodId, received: body.received }));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Mise à jour impossible." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { month?: string };
    const created = await ensureRentPeriodsForMonth(body.month);
    return Response.json({ created });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Génération impossible." },
      { status: 400 },
    );
  }
}
