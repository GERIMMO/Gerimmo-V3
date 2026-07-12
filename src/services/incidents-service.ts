import { createClient } from "@/lib/supabase/server";
import type {
  CreateIncidentInput,
  GerimmoIncident,
  IncidentCategory,
  IncidentEvent,
  IncidentsPayload,
  UpdateIncidentInput,
} from "@/types/incidents";

import { getMirrorOrganizationId } from "./administration-service";

const futureLinks = {
  devis: [],
  interventions: [],
  rapports: [],
  bot: null,
};

export async function listIncidents(): Promise<IncidentsPayload> {
  const supabase = await createClient();
  const [categories, incidents, events] = await Promise.all([
    supabase.from("incident_categories").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("incidents").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("incident_events")
      .select("id,organization_id,incident_id,actor_profile_id,action,old_values,new_values,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  for (const result of [categories, incidents, events]) {
    if (result.error) {
      throw result.error;
    }
  }
  const mirrorOrganizationId = await getMirrorOrganizationId();
  const visibleIncidents = (incidents.data ?? []) as GerimmoIncident[];
  const scopedIncidents = mirrorOrganizationId
    ? visibleIncidents.filter((incident) => incident.organization_id === mirrorOrganizationId)
    : visibleIncidents;
  const incidentIds = new Set(scopedIncidents.map((incident) => incident.id));

  return {
    categories: (categories.data ?? []) as IncidentCategory[],
    incidents: scopedIncidents,
    events: ((events.data ?? []) as IncidentEvent[]).filter(
      (event) => !mirrorOrganizationId || (event.incident_id ? incidentIds.has(event.incident_id) : false),
    ),
  };
}

export async function createIncident(input: CreateIncidentInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      number: "",
      priority: "normale",
      status: "nouveau",
      photos: [],
      future_links: futureLinks,
      ...input,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as GerimmoIncident;
}

export async function updateIncident({ id, ...input }: UpdateIncidentInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incidents")
    .update(input as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as GerimmoIncident;
}

export async function archiveIncident(id: string) {
  return updateIncident({
    id,
    status: "archive",
    archived_at: new Date().toISOString(),
  });
}
