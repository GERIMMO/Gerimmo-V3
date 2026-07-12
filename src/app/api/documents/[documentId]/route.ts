import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  archiveDocument,
  restoreDocument,
  sendDocument,
  updateDocument,
  versionDocument,
} from "@/services/documents-service";

type Params = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { documentId } = await params;
  const supabase = await createClient();
  const document = await supabase
    .from("documents")
    .select("storage_bucket,storage_path,file_name")
    .eq("id", documentId)
    .single();
  const file = document.data as {
    storage_bucket: string;
    storage_path: string | null;
    file_name: string | null;
  } | null;
  if (document.error || !file?.storage_path)
    return NextResponse.json({ message: "Fichier indisponible." }, { status: 404 });
  const signed = await supabase.storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, 300, { download: false });
  if (signed.error) return NextResponse.json({ message: "Ouverture impossible." }, { status: 403 });
  return NextResponse.json({ url: signed.data.signedUrl, fileName: file.file_name });
}

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
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Mise a jour impossible." },
      { status: 500 },
    );
  }
}
