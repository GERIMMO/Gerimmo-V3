import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/services/administration-service";
import type {
  ActiveSupervision,
  SupervisionCenterPayload,
  SupervisionContextItem,
  SupervisionDataScope,
  SupervisionEventItem,
  SupervisionHistoryItem,
  SupervisionSearchResult,
  SupervisionTargetType,
} from "@/types/supervision";

type LooseRow = Record<string, unknown>;

const COOKIE_NAME = "gerimmo_supervision_session";
const SEARCH_LIMIT = 8;

function memberTypeToTarget(memberType: string): SupervisionTargetType {
  if (memberType === "owner") return "owner";
  if (memberType === "contractor") return "contractor";
  if (memberType === "tenant") return "tenant";
  return "user";
}

function contextFromRow(row: LooseRow): SupervisionContextItem {
  return {
    id: String(row.id),
    type: String(row.context_type) as SupervisionTargetType,
    targetId: String(row.target_id),
    organizationId: String(row.organization_id),
    label: String(row.target_label),
    enteredAt: String(row.entered_at),
  };
}

async function authenticatedSuperAdminId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", data.user.id)
    .is("archived_at", null)
    .maybeSingle();
  return profile?.is_super_admin ? data.user.id : null;
}

export async function getActiveSupervision(): Promise<ActiveSupervision | null> {
  const [store, superAdminProfileId] = await Promise.all([cookies(), authenticatedSuperAdminId()]);
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId || !superAdminProfileId) return null;

  const admin = createAdminClient();
  const [{ data: session, error: sessionError }, { data: contexts, error: contextError }] = await Promise.all([
    admin
      .from("admin_supervision_sessions" as never)
      .select("id,super_admin_profile_id,root_organization_id,reason,status,started_at")
      .eq("id", sessionId)
      .eq("super_admin_profile_id", superAdminProfileId)
      .eq("status", "active")
      .maybeSingle(),
    admin
      .from("admin_supervision_contexts" as never)
      .select("id,context_type,target_id,organization_id,target_label,entered_at")
      .eq("session_id", sessionId)
      .is("exited_at", null)
      .order("entered_at"),
  ]);
  if (sessionError || contextError || !session) return null;
  const path = ((contexts ?? []) as unknown as LooseRow[]).map(contextFromRow);
  const current = path.at(-1);
  if (!current) return null;
  const sessionRow = session as unknown as LooseRow;

  return {
    sessionId: String(sessionRow.id),
    superAdminProfileId: String(sessionRow.super_admin_profile_id),
    rootOrganizationId: String(sessionRow.root_organization_id),
    reason: String(sessionRow.reason),
    startedAt: String(sessionRow.started_at),
    path,
    current,
  };
}

export async function getSupervisionOrganizationId() {
  return (await getActiveSupervision())?.rootOrganizationId ?? null;
}

export async function getSupervisionDataScope(): Promise<SupervisionDataScope | null> {
  const active = await getActiveSupervision();
  if (!active) return null;
  const { current } = active;

  if ((current.type === "agency" || current.type === "owner") && current.targetId === current.organizationId) {
    return {
      organizationId: current.organizationId,
      type: current.type,
      targetId: current.targetId,
      bienIds: null,
      profileIds: null,
    };
  }

  const admin = createAdminClient();
  let bienIds: string[] = [];
  if (current.type === "property") {
    bienIds = [current.targetId];
  } else if (current.type === "owner" || current.type === "tenant") {
    const occupantType = current.type === "owner" ? "proprietaire" : "locataire";
    const { data, error } = await admin
      .from("bien_occupants")
      .select("bien_id")
      .eq("organization_id", current.organizationId)
      .eq("profile_id", current.targetId)
      .eq("occupant_type", occupantType)
      .is("archived_at", null);
    if (error) throw error;
    bienIds = (data ?? []).map((row) => row.bien_id);
  } else if (current.type === "contractor") {
    const { data, error } = await admin
      .from("incident_interventions")
      .select("bien_id")
      .eq("organization_id", current.organizationId)
      .eq("artisan_profile_id", current.targetId)
      .is("archived_at", null);
    if (error) throw error;
    bienIds = [...new Set((data ?? []).map((row) => row.bien_id))];
  }

  let profileIds: string[] | null = [current.targetId];
  if ((current.type === "owner" || current.type === "property") && bienIds.length > 0) {
    const { data, error } = await admin
      .from("bien_occupants")
      .select("profile_id")
      .in("bien_id", bienIds)
      .is("archived_at", null);
    if (error) throw error;
    profileIds = [
      ...new Set([current.targetId, ...(data ?? []).flatMap((row) => (row.profile_id ? [row.profile_id] : []))]),
    ];
  }

  return {
    organizationId: current.organizationId,
    type: current.type,
    targetId: current.targetId,
    bienIds,
    profileIds,
  };
}

export async function assertSupervisionOrganization(organizationId: string) {
  const scope = await getSupervisionDataScope();
  if (scope && scope.organizationId !== organizationId) throw new Error("Organisation hors du périmètre supervisé.");
  return scope;
}

export async function assertSupervisionBien(bienId: string) {
  const scope = await getSupervisionDataScope();
  if (!scope) return null;
  const { data, error } = await createAdminClient()
    .from("biens")
    .select("organization_id")
    .eq("id", bienId)
    .maybeSingle();
  if (error || !data || data.organization_id !== scope.organizationId) {
    throw new Error("Bien hors du périmètre supervisé.");
  }
  if (scope.bienIds && !scope.bienIds.includes(bienId)) throw new Error("Bien hors du contexte supervisé.");
  return scope;
}

export async function getSupervisionIncidentIds(): Promise<readonly string[] | null> {
  const scope = await getSupervisionDataScope();
  if (!scope) return null;
  let query = createAdminClient()
    .from("incidents")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .is("archived_at", null);
  if (scope.bienIds) {
    if (scope.bienIds.length === 0) return [];
    query = query.in("bien_id", scope.bienIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function assertSupervisionIncident(incidentId: string) {
  const incidentIds = await getSupervisionIncidentIds();
  if (incidentIds && !incidentIds.includes(incidentId)) throw new Error("Incident hors du contexte supervisé.");
  return incidentIds;
}

export async function assertSupervisionQuoteRequest(requestId: string) {
  const { data, error } = await createAdminClient()
    .from("incident_quote_requests")
    .select("incident_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Demande de devis introuvable.");
  await assertSupervisionIncident(data.incident_id);
}

export async function getSupervisionQuoteRequestIds(): Promise<readonly string[] | null> {
  const incidentIds = await getSupervisionIncidentIds();
  if (!incidentIds) return null;
  if (incidentIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("incident_quote_requests")
    .select("id")
    .in("incident_id", incidentIds);
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function assertSupervisionSchedule(requestId: string) {
  const { data, error } = await createAdminClient()
    .from("incident_schedule_requests")
    .select("incident_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Planification introuvable.");
  await assertSupervisionIncident(data.incident_id);
}

export async function assertSupervisionIntervention(interventionId: string) {
  const { data, error } = await createAdminClient()
    .from("incident_interventions")
    .select("incident_id")
    .eq("id", interventionId)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Intervention introuvable.");
  await assertSupervisionIncident(data.incident_id);
}

export async function assertSupervisionProfile(profileId: string, organizationId: string) {
  const scope = await assertSupervisionOrganization(organizationId);
  if (!scope) return null;
  const { data, error } = await createAdminClient()
    .from("organization_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) throw new Error("Utilisateur hors de l’organisation supervisée.");
  if (scope.profileIds && !scope.profileIds.includes(profileId)) {
    throw new Error("Utilisateur hors du contexte supervisé.");
  }
  return scope;
}

export async function assertSupervisionPortal(types: readonly SupervisionTargetType[]) {
  const scope = await getSupervisionDataScope();
  if (scope && !types.includes(scope.type)) throw new Error("Action indisponible dans ce portail supervisé.");
  return scope;
}

export async function assertSupervisionManager() {
  const scope = await getSupervisionDataScope();
  if (scope && scope.type !== "agency" && !(scope.type === "owner" && scope.targetId === scope.organizationId)) {
    throw new Error("Action réservée au gestionnaire du portail supervisé.");
  }
  return scope;
}

async function organizationLabel(organizationId: string) {
  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("id,name,organization_type,status")
    .eq("id", organizationId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data || data.status !== "active") throw new Error("Organisation indisponible pour la supervision.");
  return {
    id: data.id,
    label: data.name,
    type: (data.organization_type === "independent_owner" ? "owner" : "agency") as SupervisionTargetType,
  };
}

async function resolveTarget(
  type: SupervisionTargetType,
  targetId: string,
  requiredOrganizationId?: string,
): Promise<SupervisionSearchResult> {
  const admin = createAdminClient();

  if (type === "agency" || type === "owner") {
    let organizationQuery = admin
      .from("organizations")
      .select("id,name,organization_type")
      .eq("id", targetId)
      .is("archived_at", null);
    if (requiredOrganizationId) organizationQuery = organizationQuery.eq("id", requiredOrganizationId);
    const { data: organization } = await organizationQuery.maybeSingle();
    if (organization) {
      const resolvedType = organization.organization_type === "independent_owner" ? "owner" : "agency";
      if (resolvedType !== type) throw new Error("Type de portail incohérent.");
      return {
        type,
        targetId: organization.id,
        organizationId: organization.id,
        label: organization.name,
        subtitle: resolvedType === "agency" ? "Agence immobilière" : "Propriétaire bailleur indépendant",
      };
    }
  }

  if (type === "property") {
    let propertyQuery = admin
      .from("biens")
      .select("id,organization_id,name,reference,city")
      .eq("id", targetId)
      .is("archived_at", null);
    if (requiredOrganizationId) propertyQuery = propertyQuery.eq("organization_id", requiredOrganizationId);
    const { data: property, error } = await propertyQuery.maybeSingle();
    if (error || !property) throw new Error("Bien inaccessible dans ce périmètre.");
    return {
      type,
      targetId: property.id,
      organizationId: property.organization_id,
      label: property.name,
      subtitle: [property.reference, property.city].filter(Boolean).join(" · "),
    };
  }

  let memberQuery = admin
    .from("organization_members")
    .select("organization_id,profile_id,member_type,status")
    .eq("profile_id", targetId)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1);
  if (requiredOrganizationId) memberQuery = memberQuery.eq("organization_id", requiredOrganizationId);
  const { data: memberRows, error: memberError } = await memberQuery;
  const member = memberRows?.[0];
  if (memberError || !member || memberTypeToTarget(member.member_type) !== type) {
    throw new Error("Utilisateur inaccessible dans ce périmètre.");
  }
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name,email")
    .eq("id", targetId)
    .is("archived_at", null)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Profil indisponible.");
  return {
    type,
    targetId,
    organizationId: member.organization_id,
    label: profile.full_name || profile.email || "Utilisateur GERIMMO",
    subtitle: profile.email || member.member_type,
  };
}

async function validateTransition(current: SupervisionContextItem, target: SupervisionSearchResult) {
  if (current.organizationId !== target.organizationId) throw new Error("Changement d’organisation interdit.");
  if (current.type === "agency") return;
  if (current.type === "contractor" || current.type === "tenant" || current.type === "user") {
    throw new Error("Ce portail ne permet pas d’approfondir la supervision.");
  }

  const admin = createAdminClient();
  if (current.type === "owner") {
    if (target.type !== "property") throw new Error("Un propriétaire ne peut ouvrir que ses biens.");
    if (current.targetId === current.organizationId) return;
    const { data } = await admin
      .from("bien_occupants")
      .select("id")
      .eq("bien_id", target.targetId)
      .eq("profile_id", current.targetId)
      .eq("occupant_type", "proprietaire")
      .is("archived_at", null)
      .maybeSingle();
    if (!data) throw new Error("Ce bien n’appartient pas au propriétaire supervisé.");
    return;
  }

  if (current.type === "property") {
    if (target.type !== "tenant") throw new Error("Un bien ne peut ouvrir que le portail de son locataire.");
    const { data } = await admin
      .from("bien_occupants")
      .select("id")
      .eq("bien_id", current.targetId)
      .eq("profile_id", target.targetId)
      .eq("occupant_type", "locataire")
      .is("archived_at", null)
      .maybeSingle();
    if (!data) throw new Error("Ce locataire n’occupe pas le bien supervisé.");
  }
}

async function insertEvent(
  active: Pick<ActiveSupervision, "sessionId" | "superAdminProfileId" | "rootOrganizationId">,
  action: string,
  contextId: string | null,
  details: { route?: string; resourceType?: string; resourceId?: string; metadata?: Record<string, unknown> } = {},
) {
  const { error } = await createAdminClient()
    .from("admin_supervision_events" as never)
    .insert({
      session_id: active.sessionId,
      context_id: contextId,
      actor_profile_id: active.superAdminProfileId,
      organization_id: active.rootOrganizationId,
      action,
      route: details.route ?? null,
      resource_type: details.resourceType ?? null,
      resource_id: details.resourceId ?? null,
      metadata: details.metadata ?? {},
    } as never);
  if (error) throw error;
}

export async function startSupervision(type: SupervisionTargetType, targetId: string, reason: string) {
  const { user } = await requireSuperAdmin();
  if (reason.trim().length < 5) throw new Error("Une raison de supervision est obligatoire.");
  const target = await resolveTarget(type, targetId);
  const root = await organizationLabel(target.organizationId);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: previousSessions } = await admin
    .from("admin_supervision_sessions" as never)
    .select("id")
    .eq("super_admin_profile_id", user.id)
    .eq("status", "active");
  const previousIds = ((previousSessions ?? []) as unknown as LooseRow[]).map((row) => String(row.id));
  if (previousIds.length > 0) {
    await Promise.all([
      admin
        .from("admin_supervision_sessions" as never)
        .update({ status: "ended", ended_at: now } as never)
        .in("id", previousIds),
      admin
        .from("admin_supervision_contexts" as never)
        .update({ exited_at: now } as never)
        .in("session_id", previousIds)
        .is("exited_at", null),
    ]);
  }

  const { data: session, error: sessionError } = await admin
    .from("admin_supervision_sessions" as never)
    .insert({
      super_admin_profile_id: user.id,
      root_organization_id: root.id,
      reason: reason.trim(),
    } as never)
    .select("id,root_organization_id,reason,started_at")
    .single();
  if (sessionError) throw sessionError;
  const sessionRow = session as unknown as LooseRow;
  const { data: rootContext, error: rootError } = await admin
    .from("admin_supervision_contexts" as never)
    .insert({
      session_id: sessionRow.id,
      organization_id: root.id,
      context_type: root.type,
      target_id: root.id,
      target_label: root.label,
    } as never)
    .select("id,context_type,target_id,organization_id,target_label,entered_at")
    .single();
  if (rootError) throw rootError;
  const rootRow = rootContext as unknown as LooseRow;
  let currentRow = rootRow;

  if (target.targetId !== root.id || target.type !== root.type) {
    const { data: child, error: childError } = await admin
      .from("admin_supervision_contexts" as never)
      .insert({
        session_id: sessionRow.id,
        parent_context_id: rootRow.id,
        organization_id: root.id,
        context_type: target.type,
        target_id: target.targetId,
        target_label: target.label,
      } as never)
      .select("id,context_type,target_id,organization_id,target_label,entered_at")
      .single();
    if (childError) throw childError;
    currentRow = child as unknown as LooseRow;
  }

  const activeBase = { sessionId: String(sessionRow.id), superAdminProfileId: user.id, rootOrganizationId: root.id };
  await insertEvent(activeBase, "SUPERVISION_STARTED", String(currentRow.id), {
    resourceType: target.type,
    resourceId: target.targetId,
    metadata: { reason: reason.trim(), target_label: target.label },
  });
  const store = await cookies();
  store.set(COOKIE_NAME, String(sessionRow.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
    priority: "high",
  });
  return getActiveSupervision();
}

export async function pushSupervisionContext(type: SupervisionTargetType, targetId: string) {
  await requireSuperAdmin();
  const active = await getActiveSupervision();
  if (!active) throw new Error("Aucune supervision active.");
  const target = await resolveTarget(type, targetId, active.rootOrganizationId);
  await validateTransition(active.current, target);

  const { data, error } = await createAdminClient()
    .from("admin_supervision_contexts" as never)
    .insert({
      session_id: active.sessionId,
      parent_context_id: active.current.id,
      organization_id: active.rootOrganizationId,
      context_type: target.type,
      target_id: target.targetId,
      target_label: target.label,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  await insertEvent(active, "CONTEXT_ENTERED", String((data as unknown as LooseRow).id), {
    resourceType: target.type,
    resourceId: target.targetId,
    metadata: { target_label: target.label, parent_context_id: active.current.id },
  });
  return getActiveSupervision();
}

export async function popSupervisionContext() {
  await requireSuperAdmin();
  const active = await getActiveSupervision();
  if (!active) return null;
  if (active.path.length <= 1) return stopSupervision();
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("admin_supervision_contexts" as never)
    .update({ exited_at: now } as never)
    .eq("id", active.current.id)
    .is("exited_at", null);
  if (error) throw error;
  await insertEvent(active, "CONTEXT_EXITED", active.current.id, {
    resourceType: active.current.type,
    resourceId: active.current.targetId,
  });
  return getActiveSupervision();
}

export async function stopSupervision() {
  const { user } = await requireSuperAdmin();
  const active = await getActiveSupervision();
  const store = await cookies();
  if (!active) {
    store.delete(COOKIE_NAME);
    return null;
  }
  await insertEvent(active, "SUPERVISION_ENDED", active.current.id, {
    resourceType: active.current.type,
    resourceId: active.current.targetId,
  });
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const [sessionResult, contextsResult] = await Promise.all([
    admin
      .from("admin_supervision_sessions" as never)
      .update({ status: "ended", ended_at: now } as never)
      .eq("id", active.sessionId)
      .eq("super_admin_profile_id", user.id),
    admin
      .from("admin_supervision_contexts" as never)
      .update({ exited_at: now } as never)
      .eq("session_id", active.sessionId)
      .is("exited_at", null),
  ]);
  if (sessionResult.error) throw sessionResult.error;
  if (contextsResult.error) throw contextsResult.error;
  store.delete(COOKIE_NAME);
  return null;
}

export async function recordSupervisionVisit(route: string) {
  await requireSuperAdmin();
  const active = await getActiveSupervision();
  if (!active || !route.startsWith("/dashboard")) return;
  await insertEvent(active, "PORTAL_ROUTE_VIEWED", active.current.id, {
    route: route.slice(0, 500),
    resourceType: active.current.type,
    resourceId: active.current.targetId,
  });
}

export async function recordSupervisionAction(
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
) {
  const active = await getActiveSupervision();
  if (!active) return;
  await insertEvent(active, action, active.current.id, { resourceType, resourceId, metadata });
}

export async function searchSupervisionTargets(query: string, organizationId?: string | null) {
  await requireSuperAdmin();
  const normalized = query.trim().slice(0, 80);
  if (normalized.length < 2) return [];
  const pattern = `%${normalized.replaceAll("%", "").replaceAll(",", " ")}%`;
  const admin = createAdminClient();

  let organizationsQuery = admin
    .from("organizations")
    .select("id,name,organization_type,slug")
    .ilike("name", pattern)
    .is("archived_at", null)
    .limit(SEARCH_LIMIT);
  if (organizationId) organizationsQuery = organizationsQuery.eq("id", organizationId);

  let propertiesQuery = admin
    .from("biens")
    .select("id,organization_id,name,reference,city")
    .or(`name.ilike.${pattern},reference.ilike.${pattern},city.ilike.${pattern}`)
    .is("archived_at", null)
    .limit(SEARCH_LIMIT);
  if (organizationId) propertiesQuery = propertiesQuery.eq("organization_id", organizationId);

  let membersQuery = admin
    .from("organization_members")
    .select("organization_id,profile_id,member_type")
    .eq("status", "active")
    .is("archived_at", null)
    .limit(100);
  if (organizationId) membersQuery = membersQuery.eq("organization_id", organizationId);

  const [organizations, properties, members] = await Promise.all([organizationsQuery, propertiesQuery, membersQuery]);
  for (const result of [organizations, properties, members]) if (result.error) throw result.error;

  const memberRows = (members.data ?? []) as LooseRow[];
  const profileIds = [...new Set(memberRows.map((row) => String(row.profile_id)))];
  const { data: profiles, error: profilesError } = profileIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", profileIds)
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .is("archived_at", null)
        .limit(SEARCH_LIMIT * 3)
    : { data: [], error: null };
  if (profilesError) throw profilesError;
  const profileMap = new Map(((profiles ?? []) as LooseRow[]).map((row) => [String(row.id), row]));

  const results: SupervisionSearchResult[] = [
    ...((organizations.data ?? []) as LooseRow[]).map((row) => {
      const type = row.organization_type === "independent_owner" ? "owner" : "agency";
      return {
        type,
        targetId: String(row.id),
        organizationId: String(row.id),
        label: String(row.name),
        subtitle: type === "agency" ? "Agence immobilière" : "Propriétaire bailleur indépendant",
      } as SupervisionSearchResult;
    }),
    ...((properties.data ?? []) as LooseRow[]).map(
      (row): SupervisionSearchResult => ({
        type: "property",
        targetId: String(row.id),
        organizationId: String(row.organization_id),
        label: String(row.name),
        subtitle: [row.reference, row.city].filter(Boolean).join(" · "),
      }),
    ),
    ...memberRows.flatMap((member): SupervisionSearchResult[] => {
      const profile = profileMap.get(String(member.profile_id));
      if (!profile) return [];
      return [
        {
          type: memberTypeToTarget(String(member.member_type)),
          targetId: String(member.profile_id),
          organizationId: String(member.organization_id),
          label: String(profile.full_name ?? profile.email ?? "Utilisateur GERIMMO"),
          subtitle: String(profile.email ?? member.member_type),
        },
      ];
    }),
  ];
  return [
    ...new Map(results.map((item) => [`${item.type}:${item.targetId}:${item.organizationId}`, item])).values(),
  ].slice(0, 24);
}

export async function getSupervisionCenter(): Promise<SupervisionCenterPayload> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const [active, sessionsResult, eventsResult] = await Promise.all([
    getActiveSupervision(),
    admin
      .from("admin_supervision_sessions" as never)
      .select("id,super_admin_profile_id,root_organization_id,reason,status,started_at,ended_at")
      .order("started_at", { ascending: false })
      .limit(50),
    admin
      .from("admin_supervision_events" as never)
      .select("id,action,route,resource_type,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (sessionsResult.error) throw sessionsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  const sessions = (sessionsResult.data ?? []) as unknown as LooseRow[];
  const adminIds = [...new Set(sessions.map((row) => String(row.super_admin_profile_id)))];
  const organizationIds = [...new Set(sessions.map((row) => String(row.root_organization_id)))];
  const [{ data: profiles }, { data: organizations }] = await Promise.all([
    admin.from("profiles").select("id,full_name,email").in("id", adminIds),
    admin.from("organizations").select("id,name").in("id", organizationIds),
  ]);
  const profileNames = new Map(
    ((profiles ?? []) as LooseRow[]).map((row) => [
      String(row.id),
      String(row.full_name ?? row.email ?? "Administrateur"),
    ]),
  );
  const organizationNames = new Map(
    ((organizations ?? []) as LooseRow[]).map((row) => [String(row.id), String(row.name)]),
  );

  return {
    active,
    sessions: sessions.map(
      (row): SupervisionHistoryItem => ({
        id: String(row.id),
        administratorName: profileNames.get(String(row.super_admin_profile_id)) ?? "Administrateur GERIMMO",
        organizationName: organizationNames.get(String(row.root_organization_id)) ?? "Organisation",
        reason: String(row.reason),
        status: String(row.status),
        startedAt: String(row.started_at),
        endedAt: row.ended_at ? String(row.ended_at) : null,
      }),
    ),
    events: ((eventsResult.data ?? []) as unknown as LooseRow[]).map(
      (row): SupervisionEventItem => ({
        id: String(row.id),
        action: String(row.action),
        route: row.route ? String(row.route) : null,
        resourceType: row.resource_type ? String(row.resource_type) : null,
        createdAt: String(row.created_at),
      }),
    ),
  };
}
