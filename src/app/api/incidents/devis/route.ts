import { NextResponse } from "next/server";

import { createQuoteRequest, listIncidentQuotes } from "@/services/incident-quotes-service";

export async function GET() {
  try {
    return NextResponse.json(await listIncidentQuotes());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await createQuoteRequest(body), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Creation impossible." }, { status: 500 });
  }
}
