import { NextResponse } from "next/server";

import { archiveIncident, updateIncident } from "@/services/incidents-service";

type RouteContext = {
  params: Promise<{ incidentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { incidentId } = await context.params;
    // `action` ne sert qu'à router : le retirer avant de transmettre le reste, sinon il part
    // vers PostgREST comme une colonne d'incidents (qui n'existe pas) → 400.
    const { action, ...payload } = await request.json();

    if (action === "archive") {
      return NextResponse.json(await archiveIncident(incidentId));
    }

    return NextResponse.json(await updateIncident({ id: incidentId, ...payload }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Modification impossible." },
      { status: 500 },
    );
  }
}
