import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/services/administration-service";
import type { AdminAuditEntry, AdminAuditPayload } from "@/types/admin-audit";

type LooseRow = Record<string, unknown>;

const LIMIT_PER_SOURCE = 250;

function value(row: LooseRow, key: string) {
  const result = row[key];
  return typeof result === "string" && result ? result : null;
}

export async function getAdminAuditLog(): Promise<AdminAuditPayload> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const [auditResult, supervisionResult] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id,organization_id,actor_profile_id,action,table_name,record_id,created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT_PER_SOURCE),
    admin
      .from("admin_supervision_events" as never)
      .select("id,organization_id,actor_profile_id,action,resource_type,resource_id,route,created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT_PER_SOURCE),
  ]);
  if (auditResult.error) throw auditResult.error;
  if (supervisionResult.error) throw supervisionResult.error;

  const auditRows = (auditResult.data ?? []) as LooseRow[];
  const supervisionRows = (supervisionResult.data ?? []) as unknown as LooseRow[];
  const sourceRows = [...auditRows, ...supervisionRows];
  const actorIds = [...new Set(sourceRows.flatMap((row) => value(row, "actor_profile_id") ?? []))];
  const organizationIds = [...new Set(sourceRows.flatMap((row) => value(row, "organization_id") ?? []))];

  const [profilesResult, organizationsResult, membershipsResult] = await Promise.all([
    actorIds.length > 0
      ? admin.from("profiles").select("id,full_name,email,is_super_admin").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    organizationIds.length > 0
      ? admin.from("organizations").select("id,name").in("id", organizationIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length > 0
      ? admin
          .from("organization_members")
          .select("profile_id,organization_id,member_type")
          .in("profile_id", actorIds)
          .eq("status", "active")
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (organizationsResult.error) throw organizationsResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const profiles = new Map(((profilesResult.data ?? []) as LooseRow[]).map((profile) => [String(profile.id), profile]));
  const organizations = new Map(
    ((organizationsResult.data ?? []) as LooseRow[]).map((organization) => [
      String(organization.id),
      String(organization.name),
    ]),
  );
  const memberships = new Map(
    ((membershipsResult.data ?? []) as LooseRow[]).map((membership) => [
      `${String(membership.profile_id)}:${String(membership.organization_id)}`,
      String(membership.member_type),
    ]),
  );

  function mapEntry(row: LooseRow, source: AdminAuditEntry["source"]): AdminAuditEntry {
    const actorId = value(row, "actor_profile_id");
    const organizationId = value(row, "organization_id");
    const profile = actorId ? profiles.get(actorId) : undefined;
    const superAdmin = profile?.is_super_admin === true;
    let role = "Système";
    if (superAdmin) role = "Super Admin";
    else if (actorId && organizationId) role = memberships.get(`${actorId}:${organizationId}`) ?? "Utilisateur";
    const module = source === "supervision" ? "Mode Supervision" : (value(row, "table_name") ?? "Système");
    const resource =
      source === "supervision"
        ? [value(row, "resource_type"), value(row, "resource_id")].filter(Boolean).join(" · ")
        : (value(row, "record_id") ?? module);

    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      actorId,
      actorName: String(profile?.full_name ?? profile?.email ?? (actorId ? "Utilisateur archivé" : "Système")),
      actorEmail: profile ? value(profile, "email") : null,
      organizationId,
      organizationName: organizationId ? (organizations.get(organizationId) ?? "Organisation archivée") : "GERIMMO",
      role,
      module,
      action: String(row.action),
      resource: resource || "Non renseignée",
      route: value(row, "route"),
      source,
    };
  }

  const entries = [
    ...auditRows.map((row) => mapEntry(row, "audit")),
    ...supervisionRows.map((row) => mapEntry(row, "supervision")),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    entries,
    limited: auditRows.length === LIMIT_PER_SOURCE || supervisionRows.length === LIMIT_PER_SOURCE,
  };
}
