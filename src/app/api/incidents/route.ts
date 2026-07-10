import { NextResponse } from "next/server";

import { createIncident, listIncidents } from "@/services/incidents-service";

export async function GET() {
  try {
    return NextResponse.json(await listIncidents());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await createIncident(body), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Creation impossible." }, { status: 500 });
  }
}
