export type ScheduleStatus =
  | "demande_disponibilites"
  | "creneaux_proposes"
  | "transmis_locataire"
  | "valide"
  | "relance_artisan"
  | "annule";
export type ScheduleBatchStatus = "brouillon" | "proposee" | "transmise" | "acceptee" | "refusee" | "remplacee";
export type ScheduleSlotStatus = "propose" | "selectionne" | "refuse" | "expire";
export type ScheduleActorRole = "responsable" | "locataire" | "artisan" | "systeme";
export type ScheduleResponseAction =
  | "acceptation_directe"
  | "transmission_locataire"
  | "choix_locataire"
  | "refus_locataire"
  | "nouvelle_demande_artisan"
  | "annulation";

export type IncidentScheduleRequest = {
  id: string;
  organization_id: string;
  incident_id: string;
  quote_request_id: string;
  comparison_id: string | null;
  accepted_quote_id: string;
  quote_recipient_id: string;
  artisan_profile_id: string | null;
  responsible_profile_id: string | null;
  tenant_profile_id: string | null;
  requested_by: string | null;
  status: ScheduleStatus;
  current_round: number;
  selected_slot_id: string | null;
  validated_at: string | null;
  future_links: {
    intervention: string | null;
    bot: string | null;
    notifications: string | null;
  };
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentScheduleSlotBatch = {
  id: string;
  organization_id: string;
  schedule_request_id: string;
  proposed_by: string | null;
  round_number: number;
  status: ScheduleBatchStatus;
  artisan_comment: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentScheduleSlot = {
  id: string;
  organization_id: string;
  schedule_request_id: string;
  batch_id: string;
  slot_date: string;
  starts_at: string;
  ends_at: string;
  comment: string | null;
  status: ScheduleSlotStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentScheduleResponse = {
  id: string;
  organization_id: string;
  schedule_request_id: string;
  batch_id: string | null;
  slot_id: string | null;
  actor_profile_id: string | null;
  actor_role: ScheduleActorRole;
  action: ScheduleResponseAction;
  comment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IncidentScheduleEvent = {
  id: string;
  organization_id: string | null;
  schedule_request_id: string | null;
  batch_id: string | null;
  slot_id: string | null;
  response_id: string | null;
  actor_profile_id: string | null;
  action: string;
  comment: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IncidentSchedulingPayload = {
  requests: IncidentScheduleRequest[];
  batches: IncidentScheduleSlotBatch[];
  slots: IncidentScheduleSlot[];
  responses: IncidentScheduleResponse[];
  events: IncidentScheduleEvent[];
};

export type CreateScheduleRequestInput = Pick<
  IncidentScheduleRequest,
  "organization_id" | "incident_id" | "quote_request_id" | "accepted_quote_id" | "quote_recipient_id"
> &
  Partial<
    Pick<
      IncidentScheduleRequest,
      | "comparison_id"
      | "artisan_profile_id"
      | "responsible_profile_id"
      | "tenant_profile_id"
      | "requested_by"
      | "metadata"
    >
  >;

export type ProposeScheduleSlotsInput = {
  schedule_request_id: string;
  organization_id: string;
  proposed_by?: string | null;
  artisan_comment?: string | null;
  slots: Array<Pick<IncidentScheduleSlot, "starts_at" | "ends_at"> & Partial<Pick<IncidentScheduleSlot, "comment">>>;
};

export type ScheduleDecisionInput = {
  schedule_request_id: string;
  slot_id?: string;
  actor_profile_id?: string | null;
  actor_role: ScheduleActorRole;
  action: ScheduleResponseAction;
  comment?: string | null;
};
