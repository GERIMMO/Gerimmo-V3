export type QualitySeverity = "low" | "medium" | "high" | "critical";
export type QualityPriority = "low" | "normal" | "high" | "critical";

export type QualityReport = {
  id: string;
  reference: string;
  organization_id: string | null;
  reporter_profile_id: string;
  title: string;
  description: string;
  priority: QualityPriority;
  status: string;
  screen_path: string | null;
  api_path: string | null;
  browser_info: Record<string, unknown>;
  device_info: Record<string, unknown>;
  correlation_id: string;
  created_at: string;
};

export type QualityAnalysis = {
  report_id: string;
  probable_cause: string;
  severity: QualitySeverity;
  affected_modules: string[];
  affected_files: string[];
  affected_workflows: string[];
  impacted_users_estimate: number;
  business_impact: string;
  security_impact: string;
  performance_impact: string;
  confidence_percent: number;
  evidence: Array<Record<string, unknown>>;
};

export type CorrectionProposal = {
  id: string;
  report_id: string;
  problem: string;
  cause: string;
  why: string;
  modified_files: string[];
  impacted_tables: string[];
  impacted_workflows: string[];
  impacted_users: string;
  risks: string;
  changes: string;
  unchanged: string;
  positive_outcomes: string;
  estimated_minutes: number | null;
  planned_tests: string[];
  rollback_plan: string;
  git_backup_plan: string;
  requires_human_approval: boolean;
  sensitive_areas: string[];
  status: string;
};

export type MonitoringMetric = { label: string; value: number; tone: "neutral" | "success" | "warning" | "danger" };
export type QualityCenterPayload = {
  reports: QualityReport[];
  analyses: QualityAnalysis[];
  proposals: CorrectionProposal[];
  alerts: Array<Record<string, unknown>>;
  privacyRequests: Array<Record<string, unknown>>;
  backups: Array<Record<string, unknown>>;
  metrics: MonitoringMetric[];
  sourceHealth: Array<{ source: string; errors: number; warnings: number; averageDurationMs: number }>;
};
