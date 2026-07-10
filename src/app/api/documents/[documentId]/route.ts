import { NextResponse } from "next/server";

import { archiveDocument, restoreDocument, sendDocument, updateDocument, versionDocument } from "@/services/documents-service";

type Params = {
  params: Promise<{ documentId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { documentId } = await params;
    const body = await request.json();
    const action = body.action as string | undefined;

    if (action === "archive") {
      return NextResponse.json(await archiveDocument(documentId));
    }

    if (action === "restore") {
      return NextResponse.json(await restoreDocument(documentId));
    }

    if (action === "version") {
      return NextResponse.json(await versionDocument({ id: documentId, ...body }));
    }

    if (action === "send") {
      return NextResponse.json(await sendDocument({ id: documentId, ...body }));
    }

    return NextResponse.json(await updateDocument({ id: documentId, ...body }));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Mise a jour impossible." }, { status: 500 });
  }
}
