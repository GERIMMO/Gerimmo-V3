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
    return NextResponse.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.type === "rapport") {
      return NextResponse.json(await createInterventionReport(body), { status: 201 });
    }
    if (body.type === "cloture") {
      return NextResponse.json(await createIncidentClosure(body), { status: 201 });
    }
    if (body.type === "evaluation") {
      return NextResponse.json(await createArtisanEvaluation(body), { status: 201 });
    }

    return NextResponse.json(await createIntervention(body), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Creation impossible." }, { status: 500 });
  }
}
