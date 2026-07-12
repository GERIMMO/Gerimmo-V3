import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionItem,
  AdminDashboardPayload,
  AdminLog,
  AdminOrganization,
  CmsArticle,
  PilotagePayload,
} from "@/types/administration";

type LooseRow = Record<string, unknown>;

export async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");
  const { data: profile } = await supabase.from("profiles").select("is_super_admin").eq("id", auth.user.id).single();
  if (!profile?.is_super_admin) throw new Error("Accès Super Admin requis.");
  return { user: auth.user, supabase };
}

function countBy(rows: LooseRow[], key: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key] ?? "");
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export async function getAdminDashboard(): Promise<AdminDashboardPayload> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const [organizations, properties, members, incidents, documents, logs] = await Promise.all([
    admin
      .from("organizations")
      .select("id,name,slug,organization_type,status,created_at")
      .order("created_at", { ascending: false }),
    admin.from("biens").select("organization_id").is("archived_at", null),
    admin.from("organization_members").select("organization_id").is("archived_at", null),
    admin.from("incidents").select("organization_id").is("archived_at", null),
    admin.from("documents").select("id").is("archived_at", null),
    admin
      .from("audit_logs")
      .select("id,action,table_name,created_at,organization_id")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);
  for (const result of [organizations, properties, members, incidents, documents, logs]) {
    if (result.error) throw result.error;
  }
  const propertyCounts = countBy((properties.data ?? []) as LooseRow[], "organization_id");
  const memberCounts = countBy((members.data ?? []) as LooseRow[], "organization_id");
  const incidentCounts = countBy((incidents.data ?? []) as LooseRow[], "organization_id");
  const mapped = ((organizations.data ?? []) as LooseRow[]).map(
    (row): AdminOrganization => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      organization_type: (row.organization_type ?? "agency") as AdminOrganization["organization_type"],
      status: row.status as AdminOrganization["status"],
      properties_count: propertyCounts.get(String(row.id)) ?? 0,
      users_count: memberCounts.get(String(row.id)) ?? 0,
      incidents_count: incidentCounts.get(String(row.id)) ?? 0,
      created_at: String(row.created_at),
    }),
  );
  return {
    metrics: [
      {
        label: "Agences",
        value: mapped.filter((item) => item.organization_type === "agency").length,
        href: "/dashboard/super-admin",
      },
      {
        label: "Propriétaires indépendants",
        value: mapped.filter((item) => item.organization_type === "independent_owner").length,
        href: "/dashboard/super-admin",
      },
      { label: "Biens", value: properties.data?.length ?? 0, href: "/dashboard/biens" },
      { label: "Utilisateurs", value: members.data?.length ?? 0, href: "/dashboard/utilisateurs" },
      { label: "Incidents", value: incidents.data?.length ?? 0, href: "/dashboard/incidents" },
      { label: "Documents", value: documents.data?.length ?? 0, href: "/dashboard/documents" },
    ],
    organizations: mapped,
    logs: (logs.data ?? []) as AdminLog[],
  };
}

export async function updateOrganizationStatus(organizationId: string, action: "disable" | "reactivate" | "archive") {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();
  const values =
    action === "archive"
      ? { status: "archived", archived_at: new Date().toISOString(), archived_by: user.id }
      : { status: action === "disable" ? "suspended" : "active", archived_at: null, archived_by: null };
  const { data, error } = await admin
    .from("organizations")
    .update(values)
    .eq("id", organizationId)
    .select("id,status")
    .single();
  if (error) throw error;
  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    actor_profile_id: user.id,
    action: `SUPER_ADMIN_${action.toUpperCase()}`,
    table_name: "organizations",
    record_id: organizationId,
    new_values: values,
  });
  return data;
}

export async function startMirrorSession(organizationId: string, reason: string) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();
  await admin
    .from("admin_impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("super_admin_profile_id", user.id)
    .is("ended_at", null);
  const { data, error } = await admin
    .from("admin_impersonation_sessions")
    .insert({ super_admin_profile_id: user.id, organization_id: organizationId, reason })
    .select("id")
    .single();
  if (error) throw error;
  const store = await cookies();
  store.set("gerimmo_mirror_org", organizationId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  store.set("gerimmo_mirror_session", data.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  return data;
}

export async function stopMirrorSession() {
  const { user } = await requireSuperAdmin();
  const store = await cookies();
  const sessionId = store.get("gerimmo_mirror_session")?.value;
  if (sessionId) {
    await createAdminClient()
      .from("admin_impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("super_admin_profile_id", user.id);
  }
  store.delete("gerimmo_mirror_org");
  store.delete("gerimmo_mirror_session");
}

export async function getMirrorOrganizationId() {
  const store = await cookies();
  return store.get("gerimmo_mirror_org")?.value ?? null;
}

export async function refreshRecommendations(organizationId?: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "refresh_business_recommendations" as never,
    {
      target_organization_id: organizationId ?? null,
    } as never,
  );
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getPilotage(): Promise<PilotagePayload> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("is_super_admin").eq("id", auth.user.id).single(),
    supabase
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", auth.user.id)
      .eq("status", "active")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle(),
  ]);
  await refreshRecommendations(profile?.is_super_admin ? null : membership?.organization_id);
  const [incidents, quotes, schedules, interventions, documents, subscriptions, actions, articles] = await Promise.all([
    supabase
      .from("incidents" as never)
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(cloture,archive)"),
    supabase
      .from("incident_quote_requests" as never)
      .select("id", { count: "exact", head: true })
      .eq("status", "demande"),
    supabase
      .from("incident_schedule_requests" as never)
      .select("id", { count: "exact", head: true })
      .in("status", ["demande_disponibilites", "creneaux_proposes", "transmis_locataire", "relance_artisan"]),
    supabase
      .from("incident_interventions" as never)
      .select("id", { count: "exact", head: true })
      .in("status", ["planifiee", "confirmee", "en_cours"]),
    supabase
      .from("documents" as never)
      .select("id", { count: "exact", head: true })
      .not("expires_at", "is", null)
      .lte("expires_at", new Date(Date.now() + 30 * 86400000).toISOString()),
    supabase
      .from("organization_subscriptions" as never)
      .select("id", { count: "exact", head: true })
      .in("status", ["trial", "active"]),
    supabase
      .from("business_recommendations" as never)
      .select("id,organization_id,title,explanation,severity,recommendation_type,action_url,generated_at")
      .eq("status", "active")
      .order("severity")
      .limit(100),
    supabase
      .from("cms_articles" as never)
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(6),
  ]);
  return {
    metrics: [
      { label: "Incidents ouverts", value: incidents.count ?? 0, href: "/dashboard/incidents" },
      { label: "Devis en attente", value: quotes.count ?? 0, href: "/dashboard/incidents/devis" },
      { label: "Rendez-vous", value: schedules.count ?? 0, href: "/dashboard/incidents/planification" },
      { label: "Interventions", value: interventions.count ?? 0, href: "/dashboard/incidents/dossier" },
      { label: "Documents à renouveler", value: documents.count ?? 0, href: "/dashboard/documents" },
      { label: "Abonnements actifs", value: subscriptions.count ?? 0, href: "/dashboard/super-admin" },
    ],
    actions: (actions.data ?? []) as unknown as ActionItem[],
    articles: (articles.data ?? []) as unknown as CmsArticle[],
  };
}

export async function listArticles(includeDrafts = false): Promise<CmsArticle[]> {
  const supabase = await createClient();
  let query = supabase
    .from("cms_articles" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (!includeDrafts) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CmsArticle[];
}

export async function saveArticle(
  input: Partial<CmsArticle> & Pick<CmsArticle, "title" | "summary" | "content" | "article_type" | "audience">,
) {
  const { user } = await requireSuperAdmin();
  const supabase = createAdminClient();
  const slug =
    input.slug ||
    `${input.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Date.now()}`;
  const values = {
    ...input,
    slug,
    created_by: user.id,
    updated_by: user.id,
    published_at: input.status === "published" ? new Date().toISOString() : null,
  };
  const query = input.id
    ? supabase.from("cms_articles").update(values).eq("id", input.id)
    : supabase.from("cms_articles").insert(values);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data;
}
