import { createClient } from "@/lib/supabase/server";
import type {
  CreateDocumentInput,
  DocumentAlert,
  DocumentCategory,
  DocumentEmail,
  DocumentEvent,
  DocumentOwnerOption,
  DocumentPropertyOption,
  DocumentsPayload,
  DocumentTemplate,
  DocumentVersion,
  GerimmoDocument,
  SendDocumentInput,
  UpdateDocumentInput,
  VersionDocumentInput,
} from "@/types/documents";

import {
  getSupervisionDataScope,
  narrowToSupervisionScopeOrganization,
  recordSupervisionAction,
} from "./supervision-service";

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
  const supervision = await narrowToSupervisionScopeOrganization(document.organization_id);
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
  const { data: auth } = await supabase.auth.getUser();
  const membership = auth.user
    ? await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", auth.user.id)
        .eq("status", "active")
        .is("archived_at", null)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (membership.error) throw membership.error;
  const organizationId = supervision?.organizationId ?? membership.data?.organization_id ?? null;
  const scopedDocuments = ((documents.data ?? []) as GerimmoDocument[]).filter((document) =>
    isDocumentInSupervision(document, supervision),
  );
  const documentIds = new Set(scopedDocuments.map((document) => document.id));

  let owners: DocumentOwnerOption[] = [];
  let properties: DocumentPropertyOption[] = [];
  if (organizationId) {
    const [ownerMembers, propertyRows, ownerLinks] = await Promise.all([
      supabase
        .from("organization_members")
        .select("profile_id")
        .eq("organization_id", organizationId)
        .eq("member_type", "owner")
        .eq("status", "active")
        .is("archived_at", null),
      supabase
        .from("biens" as never)
        .select("id,name,reference")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("bien_occupants" as never)
        .select("bien_id,profile_id")
        .eq("organization_id", organizationId)
        .eq("occupant_type", "proprietaire")
        .is("archived_at", null),
    ]);
    if (ownerMembers.error) throw ownerMembers.error;
    if (propertyRows.error) throw propertyRows.error;
    if (ownerLinks.error) throw ownerLinks.error;

    const organizationOwnerIds = (ownerMembers.data ?? []).map((row) => row.profile_id);
    const ownerIds =
      supervision?.type === "owner" && supervision.targetId !== supervision.organizationId
        ? organizationOwnerIds.filter((id) => id === supervision.targetId)
        : organizationOwnerIds;
    if (ownerIds.length > 0) {
      const profiles = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", ownerIds)
        .is("archived_at", null)
        .order("full_name");
      if (profiles.error) throw profiles.error;
      owners = (profiles.data ?? []).map((profile) => ({
        id: profile.id,
        name: profile.full_name || profile.email || "Propriétaire sans nom",
        email: profile.email,
      }));
    }

    const links = (ownerLinks.data ?? []) as unknown as Array<{ bien_id: string; profile_id: string | null }>;
    properties = ((propertyRows.data ?? []) as unknown as Array<{ id: string; name: string; reference: string }>).map(
      (property) => ({
        ...property,
        owner_profile_ids: links
          .filter((link) => link.bien_id === property.id && link.profile_id)
          .map((link) => link.profile_id as string),
      }),
    );
  }

  return {
    organizationId,
    categories: ((categories.data ?? []) as DocumentCategory[]).filter(
      (item) => !organizationId || item.organization_id === null || item.organization_id === organizationId,
    ),
    templates: (templates.data ?? []) as DocumentTemplate[],
    documents: scopedDocuments,
    versions: ((versions.data ?? []) as DocumentVersion[]).filter(
      (item) => !organizationId || documentIds.has(item.document_id),
    ),
    events: ((events.data ?? []) as DocumentEvent[]).filter(
      (item) => !organizationId || (item.document_id ? documentIds.has(item.document_id) : false),
    ),
    alerts: ((alerts.data ?? []) as DocumentAlert[]).filter(
      (item) => !organizationId || documentIds.has(item.document_id),
    ),
    emails: ((emails.data ?? []) as DocumentEmail[]).filter(
      (item) => !organizationId || documentIds.has(item.document_id),
    ),
    owners,
    properties,
  };
}

export async function createDocument(input: CreateDocumentInput) {
  await narrowToSupervisionScopeOrganization(input.organization_id);
  const supabase = await createClient();
  if (input.visibility === "proprietaire" && !input.owner_profile_id) {
    throw new Error("Un document propriétaire doit avoir un propriétaire destinataire.");
  }
  if (input.owner_profile_id) {
    const owner = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", input.organization_id)
      .eq("profile_id", input.owner_profile_id)
      .eq("member_type", "owner")
      .eq("status", "active")
      .is("archived_at", null)
      .maybeSingle();
    if (owner.error || !owner.data) throw new Error("Propriétaire hors de cette organisation.");
  }
  if (input.bien_id) {
    const property = await supabase
      .from("biens" as never)
      .select("id")
      .eq("id", input.bien_id)
      .eq("organization_id", input.organization_id)
      .is("archived_at", null)
      .maybeSingle();
    if (property.error || !property.data) throw new Error("Bien hors de cette organisation.");
  }
  if (input.owner_profile_id && input.bien_id) {
    const ownership = await supabase
      .from("bien_occupants" as never)
      .select("id")
      .eq("organization_id", input.organization_id)
      .eq("bien_id", input.bien_id)
      .eq("profile_id", input.owner_profile_id)
      .eq("occupant_type", "proprietaire")
      .is("archived_at", null)
      .maybeSingle();
    if (ownership.error || !ownership.data) throw new Error("Ce bien n’est pas rattaché au propriétaire sélectionné.");
  }
  if (input.category_id) {
    const category = await supabase
      .from("document_categories" as never)
      .select("id,organization_id")
      .eq("id", input.category_id)
      .is("archived_at", null)
      .maybeSingle();
    const categoryOrganizationId = (category.data as unknown as { organization_id: string | null } | null)
      ?.organization_id;
    if (
      category.error ||
      !category.data ||
      (categoryOrganizationId && categoryOrganizationId !== input.organization_id)
    ) {
      throw new Error("Catégorie documentaire hors de cette organisation.");
    }
  }
  const supervision = await getSupervisionDataScope();
  if (supervision && supervision.type !== "agency" && !(supervision.type === "owner" && supervision.bienIds === null)) {
    const candidate = {
      ...input,
      id: "nouveau",
      metadata: input.metadata ?? {},
    } as GerimmoDocument;
    if (!isDocumentInSupervision(candidate, supervision)) throw new Error("Document hors du contexte supervisé.");
  }
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
