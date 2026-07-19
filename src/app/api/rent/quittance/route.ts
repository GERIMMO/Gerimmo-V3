import { getCurrentUser } from "@/lib/auth/guards";
import { validateQuittance } from "@/services/rent-service";

// Validation humaine de la quittance. RLS (can_manage_rent) fait autorité.
export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    const body = (await request.json()) as { periodId?: string };
    if (!body.periodId) return Response.json({ message: "Période requise." }, { status: 400 });
    return Response.json(await validateQuittance({ periodId: body.periodId }));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Validation impossible." },
      { status: 400 },
    );
  }
}
