export type QuoteStatus = "demande" | "recu" | "refuse" | "expire" | "retenu";
export type ArtisanScope = "prive" | "gerimmo_valide";

export type IncidentQuoteRequest = {
  id: string;
  organization_id: string;
  incident_id: string;
  requested_by: string | null;
  title: string;
  description: string | null;
  status: QuoteStatus;
  allow_single_private_artisan: boolean;
  sent_at: string | null;
  expires_at: string | null;
  future_links: {
    validation: string | null;
    planification: string | null;
    intervention: string | null;
  };
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentQuoteRecipient = {
  id: string;
  organization_id: string;
  quote_request_id: string;
  artisan_profile_id: string | null;
  artisan_name: string;
  artisan_email: string | null;
  artisan_scope: ArtisanScope;
  status: QuoteStatus;
  sent_at: string | null;
  responded_at: string | null;
  declined_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentQuote = {
  id: string;
  organization_id: string;
  quote_request_id: string;
  recipient_id: string;
  amount_cents: number;
  currency: string;
  received_at: string;
  valid_until: string | null;
  file_name: string | null;
  storage_path: string | null;
  notes: string | null;
  status: QuoteStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentQuoteEvent = {
  id: string;
  organization_id: string | null;
  quote_request_id: string | null;
  recipient_id: string | null;
  quote_id: string | null;
  actor_profile_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IncidentQuotesPayload = {
  requests: IncidentQuoteRequest[];
  recipients: IncidentQuoteRecipient[];
  quotes: IncidentQuote[];
  events: IncidentQuoteEvent[];
};

export type CreateQuoteRequestInput = Pick<IncidentQuoteRequest, "organization_id" | "incident_id" | "title"> &
  Partial<Pick<IncidentQuoteRequest, "requested_by" | "description" | "allow_single_private_artisan" | "expires_at" | "metadata">> & {
    recipients?: Array<
      Pick<IncidentQuoteRecipient, "artisan_name" | "artisan_scope"> &
        Partial<Pick<IncidentQuoteRecipient, "artisan_profile_id" | "artisan_email" | "metadata">>
    >;
  };

export type UpdateQuoteRequestInput = Partial<CreateQuoteRequestInput> & {
  id: string;
  status?: QuoteStatus;
  sent_at?: string | null;
  archived_at?: string | null;
};

export type ReceiveQuoteInput = Pick<IncidentQuote, "organization_id" | "quote_request_id" | "recipient_id" | "amount_cents"> &
  Partial<Pick<IncidentQuote, "currency" | "valid_until" | "file_name" | "storage_path" | "notes" | "metadata">>;
