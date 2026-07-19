import { getCurrentUser } from "@/lib/auth/guards";
import { sendRentReminder } from "@/services/rent-service";

// Relance d'un loyer impayé (2 relances puis mise en demeure). RLS can_manage_rent fait autorité.
export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    const body = (await request.json()) as { periodId?: string };
    if (!body.periodId) return Response.json({ message: "Période requise." }, { status: 400 });
    return Response.json(await sendRentReminder({ periodId: body.periodId }));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Relance impossible." }, { status: 400 });
  }
}
