export type DocumentStatus = "brouillon" | "actif" | "envoye" | "expire" | "archive";
export type DocumentVisibility = "organisation" | "agence" | "proprietaire" | "locataire" | "artisan" | "prive";
export type DocumentType =
  | "rapport_incident"
  | "quittance"
  | "bon_intervention"
  | "courrier"
  | "devis"
  | "compte_rendu"
  | "contrat"
  | "attestation"
  | "autre";

export type DocumentCategory = {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_official: boolean;
  sort_order: number;
  archived_at: string | null;
};

export type DocumentTemplate = {
  id: string;
  organization_id: string | null;
  category_id: string | null;
  name: string;
  template_key: string;
  description: string | null;
  template_type: DocumentType | "document";
  content_blocks: Array<{ title: string; body?: string }>;
  merge_fields: string[];
  official_scope: "gerimmo" | "agence" | "proprietaire";
  is_active: boolean;
  archived_at: string | null;
};

export type GerimmoDocument = {
  id: string;
  organization_id: string;
  category_id: string | null;
  template_id: string | null;
  patrimoine_id: string | null;
  residence_id: string | null;
  bien_id: string | null;
  owner_profile_id: string | null;
  tenant_profile_id: string | null;
  title: string;
  reference: string;
  description: string | null;
  document_type: DocumentType;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  storage_bucket: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string;
  file_size_bytes: number;
  checksum: string | null;
  current_version: number;
  official_document: boolean;
  expires_at: string | null;
  expiration_alert_days: number;
  metadata: Record<string, unknown>;
  mail_context: Record<string, unknown>;
  bot_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  restored_at: string | null;
};

export type DocumentVersion = {
  id: string;
  organization_id: string;
  document_id: string;
  version_number: number;
  storage_bucket: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string;
  file_size_bytes: number;
  checksum: string | null;
  change_summary: string | null;
  created_at: string;
  archived_at: string | null;
};

export type DocumentEvent = {
  id: string;
  organization_id: string | null;
  document_id: string | null;
  document_version_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DocumentAlert = {
  id: string;
  organization_id: string;
  document_id: string;
  alert_type: "expiration" | "version" | "signature" | "controle";
  due_at: string;
  status: "a_traiter" | "traitee" | "archive";
  message: string | null;
  resolved_at: string | null;
  archived_at: string | null;
};

export type DocumentEmail = {
  id: string;
  organization_id: string;
  document_id: string;
  recipient_email: string;
  subject: string;
  body: string | null;
  status: "pret" | "envoye" | "erreur" | "archive";
  sent_at: string | null;
  created_at: string;
};

export type DocumentsPayload = {
  categories: DocumentCategory[];
  templates: DocumentTemplate[];
  documents: GerimmoDocument[];
  versions: DocumentVersion[];
  events: DocumentEvent[];
  alerts: DocumentAlert[];
  emails: DocumentEmail[];
};

export type CreateDocumentInput = Pick<GerimmoDocument, "organization_id" | "title" | "reference"> &
  Partial<
    Pick<
      GerimmoDocument,
      | "category_id"
      | "template_id"
      | "patrimoine_id"
      | "residence_id"
      | "bien_id"
      | "owner_profile_id"
      | "tenant_profile_id"
      | "description"
      | "document_type"
      | "status"
      | "visibility"
      | "storage_path"
      | "file_name"
      | "mime_type"
      | "file_size_bytes"
      | "checksum"
      | "current_version"
      | "official_document"
      | "expires_at"
      | "expiration_alert_days"
      | "metadata"
      | "mail_context"
      | "bot_context"
      | "archived_at"
      | "restored_at"
    >
  >;

export type UpdateDocumentInput = Partial<CreateDocumentInput> & {
  id: string;
};

export type VersionDocumentInput = {
  id: string;
  storage_path?: string | null;
  file_name?: string | null;
  mime_type?: string;
  file_size_bytes?: number;
  checksum?: string | null;
  change_summary?: string | null;
};

export type SendDocumentInput = {
  id: string;
  recipient_email: string;
  subject: string;
  body?: string | null;
};
