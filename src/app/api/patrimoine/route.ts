import { NextResponse } from "next/server";

import { createBien, createPatrimoine, createResidence, listPatrimoine } from "@/services/patrimoine-service";

export async function GET() {
  try {
    return NextResponse.json(await listPatrimoine());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Lecture impossible." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.type === "patrimoine") {
      return NextResponse.json(await createPatrimoine(body.data), { status: 201 });
    }

    if (body.type === "residence") {
      return NextResponse.json(await createResidence(body.data), { status: 201 });
    }

    if (body.type === "bien") {
      return NextResponse.json(await createBien(body.data), { status: 201 });
    }

    return NextResponse.json({ message: "Type de creation inconnu." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Creation impossible." },
      { status: 500 },
    );
  }
}
