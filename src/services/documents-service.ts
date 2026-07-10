import { createClient } from "@/lib/supabase/server";
import type {
  CreateDocumentInput,
  DocumentAlert,
  DocumentCategory,
  DocumentEmail,
  DocumentEvent,
  DocumentTemplate,
  DocumentVersion,
  DocumentsPayload,
  GerimmoDocument,
  SendDocumentInput,
  UpdateDocumentInput,
  VersionDocumentInput,
} from "@/types/documents";

export async function listDocuments(): Promise<DocumentsPayload> {
  const supabase = await createClient();
  const [categories, templates, documents, versions, events, alerts, emails] = await Promise.all([
    supabase.from("document_categories").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("document_templates").select("*").is("archived_at", null).order("name"),
    supabase.from("documents").select("*").order("updated_at", { ascending: false }),
    supabase.from("document_versions").select("*").order("version_number", { ascending: false }).limit(500),
    supabase.from("document_events").select("id,organization_id,document_id,document_version_id,action,metadata,created_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("document_alerts").select("*").order("due_at", { ascending: true }).limit(200),
    supabase.from("document_email_outbox").select("id,organization_id,document_id,recipient_email,subject,body,status,sent_at,created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  for (const result of [categories, templates, documents, versions, events, alerts, emails]) {
    if (result.error) {
      throw result.error;
    }
  }

  return {
    categories: (categories.data ?? []) as DocumentCategory[],
    templates: (templates.data ?? []) as DocumentTemplate[],
    documents: (documents.data ?? []) as GerimmoDocument[],
    versions: (versions.data ?? []) as DocumentVersion[],
    events: (events.data ?? []) as DocumentEvent[],
    alerts: (alerts.data ?? []) as DocumentAlert[],
    emails: (emails.data ?? []) as DocumentEmail[],
  };
}

export async function createDocument(input: CreateDocumentInput) {
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

  return data as GerimmoDocument;
}

export async function updateDocument({ id, ...input }: UpdateDocumentInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").update(input as never).eq("id", id).select("*").single();

  if (error) {
    throw error;
  }

  return data as GerimmoDocument;
}

export async function versionDocument({ id, change_summary, ...input }: VersionDocumentInput) {
  const supabase = await createClient();
  const current = await supabase.from("documents").select("*").eq("id", id).single();

  if (current.error) {
    throw current.error;
  }

  const document = current.data as GerimmoDocument;
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
