import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createDocument, listDocuments } from "@/services/documents-service";
import type { DocumentType, DocumentVisibility } from "@/types/documents";

import { randomUUID } from "node:crypto";

const documentTypes = new Set<DocumentType>([
  "rapport_incident",
  "quittance",
  "bon_intervention",
  "courrier",
  "devis",
  "compte_rendu",
  "contrat",
  "attestation",
  "autre",
]);
const documentVisibilities = new Set<DocumentVisibility>([
  "organisation",
  "agence",
  "proprietaire",
  "locataire",
  "artisan",
  "prive",
]);

function optionalFormValue(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  return value || null;
}

export async function GET() {
  try {
    return NextResponse.json(await listDocuments());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Lecture impossible." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const organizationId = String(form.get("organization_id") ?? "");
      const title = String(form.get("title") ?? "").trim();
      const ownerProfileId = optionalFormValue(form, "owner_profile_id");
      const bienId = optionalFormValue(form, "bien_id");
      const categoryId = optionalFormValue(form, "category_id");
      const expiresAt = optionalFormValue(form, "expires_at");
      const rawType = String(form.get("document_type") ?? "autre") as DocumentType;
      const rawVisibility = String(form.get("visibility") ?? "organisation") as DocumentVisibility;
      if (!(file instanceof File) || !organizationId || !title) {
        return NextResponse.json({ message: "Document incomplet." }, { status: 400 });
      }
      if (!documentTypes.has(rawType) || !documentVisibilities.has(rawVisibility)) {
        return NextResponse.json({ message: "Classement du document invalide." }, { status: 400 });
      }
      if (rawVisibility === "proprietaire" && !ownerProfileId) {
        return NextResponse.json({ message: "Sélectionnez le propriétaire destinataire." }, { status: 400 });
      }
      const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
      if (!allowed.has(file.type) || file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ message: "Format invalide ou fichier supérieur à 20 Mo." }, { status: 400 });
      }
      const documentId = randomUUID();
      const safeName = file.name.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${organizationId}/${documentId}/${randomUUID()}-${safeName}`;
      const supabase = await createClient();
      const upload = await supabase.storage.from("documents").upload(storagePath, file, { contentType: file.type });
      if (upload.error) throw upload.error;
      try {
        const document = await createDocument({
          id: documentId,
          organization_id: organizationId,
          title,
          reference: String(form.get("reference") ?? `DOC-${Date.now()}`),
          document_type: rawType,
          visibility: rawVisibility,
          category_id: categoryId,
          owner_profile_id: ownerProfileId,
          bien_id: bienId,
          expires_at: expiresAt,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
        });
        return NextResponse.json(document, { status: 201 });
      } catch (error) {
        await supabase.storage.from("documents").remove([storagePath]);
        throw error;
      }
    }
    const body = await request.json();
    return NextResponse.json(await createDocument(body), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Creation impossible." },
      { status: 500 },
    );
  }
}
