import { NextResponse } from "next/server";

import {
  createArtisanEvaluation,
  createIncidentClosure,
  createIntervention,
  createInterventionReport,
  listIncidentFinalization,
} from "@/services/incident-finalization-service";

export async function GET() {
  try {
    return NextResponse.json(await listIncidentFinalization());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Lecture impossible." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    // `type` ne sert qu'à router la requête : le retirer avant de transmettre le reste aux
    // services, qui insèrent le payload tel quel en base (une clé de routage laissée dedans
    // est interprétée comme une colonne → erreur 400). `action` est conservé : c'est une
    // vraie colonne pour la clôture.
    const { type, ...payload } = await request.json();

    if (type === "rapport") {
      return NextResponse.json(await createInterventionReport(payload), { status: 201 });
    }
    if (type === "cloture") {
      return NextResponse.json(await createIncidentClosure(payload), { status: 201 });
    }
    if (type === "evaluation") {
      return NextResponse.json(await createArtisanEvaluation(payload), { status: 201 });
    }

    return NextResponse.json(await createIntervention(payload), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Creation impossible." },
      { status: 500 },
    );
  }
}
