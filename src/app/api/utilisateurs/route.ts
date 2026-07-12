import { NextResponse } from "next/server";

import { inviteUser, listUsers } from "@/services/utilisateurs-service";

export async function GET() {
  try {
    return NextResponse.json(await listUsers());
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
    return NextResponse.json(await inviteUser(body), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invitation impossible." },
      { status: 500 },
    );
  }
}
