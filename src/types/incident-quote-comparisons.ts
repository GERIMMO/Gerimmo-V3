export type ComparisonStatus = "brouillon" | "recommande" | "valide" | "refuse" | "complement" | "annule";
export type ComparisonDecision = "en_attente" | "accepte" | "refuse" | "complement";

export type IncidentQuoteComparison = {
  id: string;
  organization_id: string;
  quote_request_id: string;
  responsible_profile_id: string | null;
  recommended_quote_id: string | null;
  recommendation_reason: string | null;
  status: ComparisonStatus;
  future_links: {
    planification: string | null;
    intervention: string | null;
  };
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentQuoteComparisonItem = {
  id: string;
  organization_id: string;
  comparison_id: string;
  quote_id: string;
  recipient_id: string;
  artisan_name: string;
  price_cents: number;
  announced_delay_days: number | null;
  gerimmo_rating: number;
  administrative_documents_valid: boolean;
  received_at: string;
  comments: string | null;
  recommendation_score: number;
  is_recommended: boolean;
  decision_status: ComparisonDecision;
  decision_comment: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentQuoteValidationEvent = {
  id: string;
  organization_id: string | null;
  comparison_id: string | null;
  quote_id: string | null;
  actor_profile_id: string | null;
  action: string;
  comment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IncidentQuoteComparisonsPayload = {
  comparisons: IncidentQuoteComparison[];
  items: IncidentQuoteComparisonItem[];
  events: IncidentQuoteValidationEvent[];
};

export type CreateComparisonInput = Pick<IncidentQuoteComparison, "organization_id" | "quote_request_id"> &
  Partial<Pick<IncidentQuoteComparison, "responsible_profile_id" | "metadata">> & {
    items: Array<
      Pick<
        IncidentQuoteComparisonItem,
        | "quote_id"
        | "recipient_id"
        | "artisan_name"
        | "price_cents"
        | "received_at"
        | "gerimmo_rating"
        | "administrative_documents_valid"
      > &
        Partial<Pick<IncidentQuoteComparisonItem, "announced_delay_days" | "comments">>
    >;
  };

export type DecideComparisonInput = {
  comparison_id: string;
  quote_id?: string;
  decision: "accept" | "refuse" | "complement" | "cancel";
  comment?: string | null;
};
