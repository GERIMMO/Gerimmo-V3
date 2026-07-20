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
    // `type` et `action` servent uniquement à router la requête : les retirer avant de
    // transmettre le reste aux services, qui écrivent le payload tel quel en base
    // (une clé de routage laissée dedans est interprétée comme une colonne → erreur 400).
    const { type, ...payload } = await request.json();

    if (type === "rapport") {
      // `action` est conservé : updateInterventionReport s'en sert pour déduire le statut.
      return NextResponse.json(await updateInterventionReport({ id: resourceId, ...payload }));
    }
    if (type === "materiau") {
      return NextResponse.json(await addInterventionMaterial({ intervention_id: resourceId, ...payload }), {
        status: 201,
      });
    }

    const { action, ...interventionPatch } = payload;

    if (action === "demarrer") {
      return NextResponse.json(await startIntervention(resourceId));
    }
    if (action === "suspendre") {
      return NextResponse.json(await suspendIntervention(resourceId, payload.comment));
    }
    if (action === "reprendre") {
      return NextResponse.json(await resumeIntervention(resourceId));
    }
    if (action === "annuler") {
      return NextResponse.json(await cancelIntervention(resourceId, payload.comment));
    }
    if (action === "reprogrammer") {
      return NextResponse.json(await reprogramIntervention(resourceId, payload.comment));
    }
    if (action === "terminer") {
      return NextResponse.json(await completeIntervention({ id: resourceId, ...interventionPatch }));
    }

    return NextResponse.json(await updateIntervention({ id: resourceId, ...interventionPatch }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Action impossible." },
      { status: 500 },
    );
  }
}
