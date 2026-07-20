import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  CreateIncidentInput,
  GerimmoIncident,
  IncidentCategory,
  IncidentEvent,
  IncidentsPayload,
  UpdateIncidentInput,
} from "@/types/incidents";

import { getSupervisionDataScope, narrowToSupervisionScopeBien, recordSupervisionAction } from "./supervision-service";

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
  const supervision = await getSupervisionDataScope();
  const supervisedOrganizationId = supervision?.organizationId ?? null;
  const visibleIncidents = (incidents.data ?? []) as GerimmoIncident[];
  const scopedIncidents = supervisedOrganizationId
    ? visibleIncidents.filter(
        (incident) =>
          incident.organization_id === supervisedOrganizationId &&
          (!supervision?.bienIds || supervision.bienIds.includes(incident.bien_id)),
      )
    : visibleIncidents;
  const incidentIds = new Set(scopedIncidents.map((incident) => incident.id));

  return {
    categories: (categories.data ?? []) as IncidentCategory[],
    incidents: scopedIncidents,
    events: ((events.data ?? []) as IncidentEvent[]).filter(
      (event) => !supervisedOrganizationId || (event.incident_id ? incidentIds.has(event.incident_id) : false),
    ),
  };
}

export async function createIncident(input: CreateIncidentInput) {
  await narrowToSupervisionScopeBien(input.bien_id);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");
  const property = await supabase
    .from("biens")
    .select("organization_id")
    .eq("id", input.bien_id)
    .eq("organization_id", input.organization_id)
    .is("archived_at", null)
    .maybeSingle();
  if (property.error || !property.data) throw new Error("Bien hors de cette organisation.");
  if (input.category_id) {
    const category = await supabase
      .from("incident_categories")
      .select("id,organization_id")
      .eq("id", input.category_id)
      .is("archived_at", null)
      .maybeSingle();
    const categoryOrganizationId = (category.data as { organization_id: string | null } | null)?.organization_id;
    if (
      category.error ||
      !category.data ||
      (categoryOrganizationId && categoryOrganizationId !== input.organization_id)
    ) {
      throw new Error("Catégorie d’incident hors de cette organisation.");
    }
  }
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      number: "",
      priority: "normale",
      status: "nouveau",
      photos: [],
      future_links: futureLinks,
      ...input,
      created_by: auth.user.id,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const incident = data as GerimmoIncident;
  await recordSupervisionAction("INCIDENT_CREATED", "incident", incident.id);
  return incident;
}

export async function updateIncident({ id, ...input }: UpdateIncidentInput) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("incidents")
    .select("bien_id")
    .eq("id", id)
    .maybeSingle();
  if (currentError || !current) throw currentError ?? new Error("Incident introuvable.");
  await narrowToSupervisionScopeBien(input.bien_id ?? current.bien_id);
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

  const incident = data as GerimmoIncident;
  await recordSupervisionAction("INCIDENT_UPDATED", "incident", incident.id);
  return incident;
}

export async function archiveIncident(id: string) {
  return updateIncident({
    id,
    status: "archive",
    archived_at: new Date().toISOString(),
  });
}
