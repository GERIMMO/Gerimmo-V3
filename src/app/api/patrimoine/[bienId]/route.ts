import { NextResponse } from "next/server";

import { archiveBien, updateBien } from "@/services/patrimoine-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ bienId: string }> }) {
  try {
    const { bienId } = await params;
    const body = await request.json();
    return NextResponse.json(await updateBien({ id: bienId, ...body }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Modification impossible." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ bienId: string }> }) {
  try {
    const { bienId } = await params;
    return NextResponse.json(await archiveBien(bienId));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Archivage impossible." },
      { status: 500 },
    );
  }
}
