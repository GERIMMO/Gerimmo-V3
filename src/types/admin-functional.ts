export type AdminMetric = {
  label: string;
  value: number;
  suffix?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export type AdminTableRow = Record<string, string | number | boolean | null | string[]> & { id: string };

export type AdminFunctionalPayload = {
  section: string;
  title: string;
  description: string;
  metrics: AdminMetric[];
  rows: AdminTableRow[];
  secondaryRows?: AdminTableRow[];
  options?: {
    organizations?: Array<{ id: string; name: string }>;
    plans?: Array<{ id: string; name: string }>;
    profiles?: Array<{ id: string; name: string }>;
  };
};

export type AdminMutationAction =
  | "subscription_status"
  | "subscription_plan"
  | "promotion_create"
  | "promotion_update"
  | "promotion_duplicate"
  | "promotion_archive"
  | "support_update"
  | "bug_decision"
  | "idea_decision"
  | "communication_create"
  | "communication_update"
  | "template_create"
  | "template_update"
  | "workflow_retry"
  | "integration_check"
  | "ai_generate"
  | "ai_decision";

export type AdminMutationInput = {
  action: AdminMutationAction;
  id?: string;
  values?: Record<string, unknown>;
};
