import { createClient } from "@/lib/supabase/server";
import type {
  CreateDocumentInput,
  DocumentAlert,
  DocumentCategory,
  DocumentEmail,
  DocumentEvent,
  DocumentsPayload,
  DocumentTemplate,
  DocumentVersion,
  GerimmoDocument,
  SendDocumentInput,
  UpdateDocumentInput,
  VersionDocumentInput,
} from "@/types/documents";

import { assertSupervisionOrganization, getSupervisionDataScope, recordSupervisionAction } from "./supervision-service";

function isDocumentInSupervision(
  document: GerimmoDocument,
  supervision: Awaited<ReturnType<typeof getSupervisionDataScope>>,
) {
  if (!supervision) return true;
  if (document.organization_id !== supervision.organizationId) return false;
  if (supervision.type === "agency" || (supervision.type === "owner" && supervision.bienIds === null)) return true;
  if (supervision.type === "property") return document.bien_id === supervision.targetId;
  if (supervision.type === "tenant") {
    return (
      document.tenant_profile_id === supervision.targetId ||
      (Boolean(document.bien_id && supervision.bienIds?.includes(document.bien_id)) &&
        document.visibility === "locataire")
    );
  }
  if (supervision.type === "owner") {
    return (
      document.owner_profile_id === supervision.targetId ||
      Boolean(document.bien_id && supervision.bienIds?.includes(document.bien_id))
    );
  }
  if (supervision.type === "contractor") {
    return document.visibility === "artisan" && document.metadata.artisan_profile_id === supervision.targetId;
  }
  return document.owner_profile_id === supervision.targetId || document.tenant_profile_id === supervision.targetId;
}

async function assertDocumentSupervision(document: GerimmoDocument) {
  const supervision = await assertSupervisionOrganization(document.organization_id);
  if (supervision && !isDocumentInSupervision(document, supervision)) {
    throw new Error("Document hors du contexte supervisé.");
  }
}

export async function listDocuments(): Promise<DocumentsPayload> {
  const supabase = await createClient();
  const [categories, templates, documents, versions, events, alerts, emails] = await Promise.all([
    supabase.from("document_categories").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("document_templates").select("*").is("archived_at", null).order("name"),
    supabase.from("documents").select("*").order("updated_at", { ascending: false }),
    supabase.from("document_versions").select("*").order("version_number", { ascending: false }).limit(500),
    supabase
      .from("document_events")
      .select("id,organization_id,document_id,document_version_id,action,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("document_alerts").select("*").order("due_at", { ascending: true }).limit(200),
    supabase
      .from("document_email_outbox")
      .select("id,organization_id,document_id,recipient_email,subject,body,status,sent_at,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  for (const result of [categories, templates, documents, versions, events, alerts, emails]) {
    if (result.error) {
      throw result.error;
    }
  }
  const supervision = await getSupervisionDataScope();
  const supervisedOrganizationId = supervision?.organizationId ?? null;
  const scopedDocuments = ((documents.data ?? []) as GerimmoDocument[]).filter((document) =>
    isDocumentInSupervision(document, supervision),
  );
  const documentIds = new Set(scopedDocuments.map((document) => document.id));

  return {
    categories: ((categories.data ?? []) as DocumentCategory[]).filter(
      (item) =>
        !supervisedOrganizationId || item.organization_id === null || item.organization_id === supervisedOrganizationId,
    ),
    templates: (templates.data ?? []) as DocumentTemplate[],
    documents: scopedDocuments,
    versions: ((versions.data ?? []) as DocumentVersion[]).filter(
      (item) => !supervisedOrganizationId || documentIds.has(item.document_id),
    ),
    events: ((events.data ?? []) as DocumentEvent[]).filter(
      (item) => !supervisedOrganizationId || (item.document_id ? documentIds.has(item.document_id) : false),
    ),
    alerts: ((alerts.data ?? []) as DocumentAlert[]).filter(
      (item) => !supervisedOrganizationId || documentIds.has(item.document_id),
    ),
    emails: ((emails.data ?? []) as DocumentEmail[]).filter(
      (item) => !supervisedOrganizationId || documentIds.has(item.document_id),
    ),
  };
}

export async function createDocument(input: CreateDocumentInput) {
  await assertSupervisionOrganization(input.organization_id);
  const supervision = await getSupervisionDataScope();
  if (supervision && supervision.type !== "agency" && !(supervision.type === "owner" && supervision.bienIds === null)) {
    const candidate = {
      ...input,
      id: "nouveau",
      metadata: input.metadata ?? {},
    } as GerimmoDocument;
    if (!isDocumentInSupervision(candidate, supervision)) throw new Error("Document hors du contexte supervisé.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      document_type: "autre",
      status: "actif",
      visibility: "organisation",
      ...input,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const document = data as GerimmoDocument;
  await recordSupervisionAction("DOCUMENT_CREATED", "document", document.id);
  return document;
}

export async function updateDocument({ id, ...input }: UpdateDocumentInput) {
  const supabase = await createClient();
  const current = await supabase.from("documents").select("*").eq("id", id).single();
  if (current.error) throw current.error;
  const currentDocument = current.data as GerimmoDocument;
  await assertDocumentSupervision(currentDocument);
  const supervision = await getSupervisionDataScope();
  if (supervision && !isDocumentInSupervision({ ...currentDocument, ...input }, supervision)) {
    throw new Error("Modification hors du contexte supervisé.");
  }
  const { data, error } = await supabase
    .from("documents")
    .update(input as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const document = data as GerimmoDocument;
  await recordSupervisionAction("DOCUMENT_UPDATED", "document", document.id);
  return document;
}

export async function versionDocument({ id, change_summary, ...input }: VersionDocumentInput) {
  const supabase = await createClient();
  const current = await supabase.from("documents").select("*").eq("id", id).single();

  if (current.error) {
    throw current.error;
  }

  const document = current.data as GerimmoDocument;
  await assertDocumentSupervision(document);
  const nextVersion = document.current_version + 1;

  const version = await supabase
    .from("document_versions")
    .insert({
      organization_id: document.organization_id,
      document_id: id,
      version_number: nextVersion,
      storage_bucket: document.storage_bucket,
      storage_path: input.storage_path ?? document.storage_path,
      file_name: input.file_name ?? document.file_name,
      mime_type: input.mime_type ?? document.mime_type,
      file_size_bytes: input.file_size_bytes ?? document.file_size_bytes,
      checksum: input.checksum ?? document.checksum,
      change_summary: change_summary ?? "Nouvelle version",
    } as never)
    .select("*")
    .single();

  if (version.error) {
    throw version.error;
  }

  return updateDocument({
    id,
    current_version: nextVersion,
    storage_path: input.storage_path ?? document.storage_path,
    file_name: input.file_name ?? document.file_name,
    mime_type: input.mime_type ?? document.mime_type,
    file_size_bytes: input.file_size_bytes ?? document.file_size_bytes,
    checksum: input.checksum ?? document.checksum,
  });
}

export async function archiveDocument(id: string) {
  return updateDocument({ id, status: "archive", archived_at: new Date().toISOString() });
}

export async function restoreDocument(id: string) {
  return updateDocument({ id, status: "actif", archived_at: null, restored_at: new Date().toISOString() });
}

export async function sendDocument(input: SendDocumentInput) {
  const supabase = await createClient();
  const current = await supabase.from("documents").select("id,organization_id").eq("id", input.id).single();

  if (current.error) {
    throw current.error;
  }

  const organizationId = (current.data as { organization_id: string }).organization_id;
  const document = await supabase.from("documents").select("*").eq("id", input.id).single();
  if (document.error) throw document.error;
  await assertDocumentSupervision(document.data as GerimmoDocument);
  const { data, error } = await supabase
    .from("document_email_outbox")
    .insert({
      organization_id: organizationId,
      document_id: input.id,
      recipient_email: input.recipient_email,
      subject: input.subject,
      body: input.body,
      status: "pret",
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await updateDocument({ id: input.id, status: "envoye" });

  return data as DocumentEmail;
}
