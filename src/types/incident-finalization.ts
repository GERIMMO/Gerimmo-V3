import type { IncidentPhoto } from "@/types/incidents";

export type InterventionStatus = "planifiee" | "confirmee" | "en_cours" | "suspendue" | "terminee" | "annulee" | "a_reprogrammer";
export type InterventionMode = "artisan_gerimmo" | "artisan_prive" | "interne";
export type InterventionReportStatus = "brouillon" | "previsualise" | "modifie" | "genere" | "valide" | "archive";
export type ClosureAction = "validation" | "correction" | "nouvelle_intervention" | "cloture_reserve" | "cloture_normale";
export type EvaluatorRole = "locataire" | "responsable";

export type IncidentIntervention = {
  id: string;
  organization_id: string;
  incident_id: string;
  bien_id: string;
  schedule_request_id: string | null;
  selected_slot_id: string | null;
  accepted_quote_id: string | null;
  quote_recipient_id: string | null;
  artisan_profile_id: string | null;
  internal_intervenant_profile_id: string | null;
  responsible_profile_id: string | null;
  tenant_profile_id: string | null;
  execution_mode: InterventionMode;
  planned_starts_at: string;
  planned_ends_at: string;
  actual_starts_at: string | null;
  actual_ends_at: string | null;
  status: InterventionStatus;
  work_description: string | null;
  artisan_comment: string | null;
  responsible_comment: string | null;
  photos_before: IncidentPhoto[];
  photos_during: IncidentPhoto[];
  photos_after: IncidentPhoto[];
  planned_amount_cents: number;
  final_amount_cents: number | null;
  amount_difference_cents: number | null;
  difference_reason: string | null;
  completion_validation: Record<string, unknown>;
  future_links: { rapport: string | null; bot: string | null; notifications: string | null };
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type InterventionMaterial = {
  id: string;
  organization_id: string;
  intervention_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  amount_cents: number;
  created_at: string;
  archived_at: string | null;
};

export type InterventionEvent = {
  id: string;
  organization_id: string | null;
  intervention_id: string | null;
  incident_id: string | null;
  actor_profile_id: string | null;
  action: string;
  comment: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type InterventionReport = {
  id: string;
  organization_id: string;
  incident_id: string;
  intervention_id: string;
  document_id: string | null;
  report_reference: string;
  status: InterventionReportStatus;
  report_data: Record<string, unknown>;
  observations: string | null;
  validation_comment: string | null;
  generated_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  downloaded_at: string | null;
  printed_at: string | null;
  email_prepared_at: string | null;
  pdf_storage_path: string | null;
  pdf_file_name: string | null;
  pdf_checksum: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type InterventionReportEvent = {
  id: string;
  organization_id: string | null;
  report_id: string | null;
  intervention_id: string | null;
  document_id: string | null;
  actor_profile_id: string | null;
  action: string;
  comment: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IncidentClosureReview = {
  id: string;
  organization_id: string;
  incident_id: string;
  intervention_id: string;
  report_id: string;
  responsible_profile_id: string | null;
  action: ClosureAction;
  status: "a_verifier" | "valide" | "correction_demandee" | "nouvelle_intervention" | "cloture_reserve" | "cloture_normale";
  comment: string | null;
  reserve_details: string | null;
  correction_requested: string | null;
  new_intervention_required: boolean;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
};

export type ArtisanEvaluation = {
  id: string;
  organization_id: string;
  incident_id: string;
  intervention_id: string;
  artisan_profile_id: string | null;
  evaluator_profile_id: string;
  evaluator_role: EvaluatorRole;
  work_quality: number;
  appointment_respect: number;
  communication: number;
  cleanliness: number;
  overall_rating: number;
  average_rating: number;
  comment: string | null;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  archived_at: string | null;
};

export type ArtisanRatingStatistic = {
  organization_id: string;
  artisan_profile_id: string;
  evaluations_count: number;
  average_rating: number;
};

export type IncidentFinalizationPayload = {
  interventions: IncidentIntervention[];
  materials: InterventionMaterial[];
  interventionEvents: InterventionEvent[];
  reports: InterventionReport[];
  reportEvents: InterventionReportEvent[];
  closures: IncidentClosureReview[];
  evaluations: ArtisanEvaluation[];
  ratingStatistics: ArtisanRatingStatistic[];
};

export type CreateInterventionInput = Pick<
  IncidentIntervention,
  "organization_id" | "incident_id" | "bien_id" | "planned_starts_at" | "planned_ends_at" | "execution_mode"
> &
  Partial<
    Pick<
      IncidentIntervention,
      | "schedule_request_id"
      | "selected_slot_id"
      | "accepted_quote_id"
      | "quote_recipient_id"
      | "artisan_profile_id"
      | "internal_intervenant_profile_id"
      | "responsible_profile_id"
      | "tenant_profile_id"
      | "work_description"
      | "planned_amount_cents"
      | "created_by"
      | "metadata"
    >
  >;

export type UpdateInterventionInput = Partial<
  Pick<
    IncidentIntervention,
    | "status"
    | "actual_starts_at"
    | "actual_ends_at"
    | "work_description"
    | "artisan_comment"
    | "responsible_comment"
    | "photos_before"
    | "photos_during"
    | "photos_after"
    | "final_amount_cents"
    | "difference_reason"
    | "completion_validation"
  >
> & { id: string };

export type CreateReportInput = {
  intervention_id: string;
  created_by?: string | null;
  observations?: string | null;
};

export type UpdateReportInput = Partial<Pick<InterventionReport, "status" | "report_data" | "observations" | "validation_comment" | "validated_by">> & {
  id: string;
  action?: "preview" | "edit" | "generate" | "validate" | "download" | "print" | "prepare_email" | "archive";
};

export type CreateClosureInput = Pick<IncidentClosureReview, "organization_id" | "incident_id" | "intervention_id" | "report_id" | "action"> &
  Partial<Pick<IncidentClosureReview, "responsible_profile_id" | "comment" | "reserve_details" | "correction_requested" | "new_intervention_required" | "created_by">>;

export type CreateEvaluationInput = Pick<
  ArtisanEvaluation,
  | "organization_id"
  | "incident_id"
  | "intervention_id"
  | "evaluator_profile_id"
  | "evaluator_role"
  | "work_quality"
  | "appointment_respect"
  | "communication"
  | "cleanliness"
  | "overall_rating"
> &
  Partial<Pick<ArtisanEvaluation, "artisan_profile_id" | "comment" | "flagged" | "flag_reason">>;
