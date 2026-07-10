export type IncidentPriority = "basse" | "normale" | "haute" | "urgente";
export type IncidentStatus = "nouveau" | "en_cours" | "cloture" | "archive";

export type IncidentPhoto = {
  name: string;
  url?: string | null;
  size_bytes?: number | null;
  mime_type?: string | null;
};

export type IncidentCategory = {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  is_official: boolean;
  sort_order: number;
  archived_at: string | null;
};

export type GerimmoIncident = {
  id: string;
  number: string;
  organization_id: string;
  bien_id: string;
  created_by: string | null;
  responsible_profile_id: string | null;
  category_id: string | null;
  category: string;
  subcategory: string | null;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  photos: IncidentPhoto[];
  future_links: {
    devis: string[];
    interventions: string[];
    rapports: string[];
    bot: string | null;
  };
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type IncidentEvent = {
  id: string;
  organization_id: string | null;
  incident_id: string | null;
  actor_profile_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type IncidentsPayload = {
  categories: IncidentCategory[];
  incidents: GerimmoIncident[];
  events: IncidentEvent[];
};

export type CreateIncidentInput = Pick<
  GerimmoIncident,
  "organization_id" | "bien_id" | "category" | "description"
> &
  Partial<
    Pick<
      GerimmoIncident,
      | "number"
      | "created_by"
      | "responsible_profile_id"
      | "category_id"
      | "subcategory"
      | "priority"
      | "status"
      | "photos"
      | "future_links"
      | "metadata"
    >
  >;

export type UpdateIncidentInput = Partial<CreateIncidentInput> & {
  id: string;
  archived_at?: string | null;
};
