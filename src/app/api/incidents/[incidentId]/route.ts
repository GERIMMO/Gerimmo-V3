import { NextResponse } from "next/server";

import { archiveIncident, updateIncident } from "@/services/incidents-service";

type RouteContext = {
  params: Promise<{ incidentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { incidentId } = await context.params;
    const body = await request.json();

    if (body.action === "archive") {
      return NextResponse.json(await archiveIncident(incidentId));
    }

    return NextResponse.json(await updateIncident({ id: incidentId, ...body }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Modification impossible." },
      { status: 500 },
    );
  }
}
