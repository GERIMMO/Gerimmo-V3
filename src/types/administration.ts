export type OrganizationType = "agency" | "independent_owner" | "internal";

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  organization_type: OrganizationType;
  status: "active" | "suspended" | "archived";
  properties_count: number;
  users_count: number;
  incidents_count: number;
  created_at: string;
};

export type NationalMetric = {
  label: string;
  value: number;
  href: string;
};

export type AdminLog = {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  organization_id: string | null;
};

export type AdminDashboardPayload = {
  metrics: NationalMetric[];
  organizations: AdminOrganization[];
  logs: AdminLog[];
};

export type ActionItem = {
  id: string;
  organization_id: string | null;
  title: string;
  explanation: string;
  severity: "info" | "attention" | "urgent";
  recommendation_type: string;
  action_url: string | null;
  generated_at: string;
};

export type PilotagePayload = {
  metrics: NationalMetric[];
  actions: ActionItem[];
  articles: CmsArticle[];
};

export type CmsArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  article_type: "article" | "news" | "maintenance" | "release";
  status: "draft" | "published" | "archived";
  audience: "all" | "agencies" | "independent_owners";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportEntity = "agency" | "owner" | "property" | "tenant";
export type ImportRowPreview = {
  row_number: number;
  entity_type: ImportEntity;
  source_data: Record<string, string>;
  normalized_data: Record<string, unknown>;
  status: "valid" | "duplicate" | "error";
  errors: string[];
  duplicate_key: string | null;
};

export type ImportJob = {
  id: string;
  file_name: string;
  file_type: "csv" | "xlsx";
  status: "draft" | "validated" | "processing" | "partial" | "completed" | "failed" | "archived";
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  duplicate_rows: number;
  processed_rows: number;
  created_at: string;
  completed_at: string | null;
};

export type ImportPreview = { job: ImportJob; rows: ImportRowPreview[] };
