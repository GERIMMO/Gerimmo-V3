import { NextResponse } from "next/server";

import {
  addInterventionMaterial,
  cancelIntervention,
  completeIntervention,
  reprogramIntervention,
  resumeIntervention,
  startIntervention,
  suspendIntervention,
  updateIntervention,
  updateInterventionReport,
} from "@/services/incident-finalization-service";

type RouteContext = {
  params: Promise<{ resourceId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { resourceId } = await context.params;
    const body = await request.json();

    if (body.type === "rapport") {
      return NextResponse.json(await updateInterventionReport({ id: resourceId, ...body }));
    }
    if (body.type === "materiau") {
      return NextResponse.json(await addInterventionMaterial({ intervention_id: resourceId, ...body }), {
        status: 201,
      });
    }
    if (body.action === "demarrer") {
      return NextResponse.json(await startIntervention(resourceId));
    }
    if (body.action === "suspendre") {
      return NextResponse.json(await suspendIntervention(resourceId, body.comment));
    }
    if (body.action === "reprendre") {
      return NextResponse.json(await resumeIntervention(resourceId));
    }
    if (body.action === "annuler") {
      return NextResponse.json(await cancelIntervention(resourceId, body.comment));
    }
    if (body.action === "reprogrammer") {
      return NextResponse.json(await reprogramIntervention(resourceId, body.comment));
    }
    if (body.action === "terminer") {
      return NextResponse.json(await completeIntervention({ id: resourceId, ...body }));
    }

    return NextResponse.json(await updateIntervention({ id: resourceId, ...body }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Action impossible." },
      { status: 500 },
    );
  }
}
