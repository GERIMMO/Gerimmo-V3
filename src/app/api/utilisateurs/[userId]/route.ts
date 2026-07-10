import { NextResponse } from "next/server";

import { updateUser } from "@/services/utilisateurs-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const body = await request.json();
    return NextResponse.json(await updateUser({ profile_id: userId, ...body }));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Modification impossible." }, { status: 500 });
  }
}
