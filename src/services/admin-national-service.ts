import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/services/administration-service";
import type {
  AdminNationalColumn,
  AdminNationalPayload,
  AdminNationalRow,
  AdminNationalValue,
} from "@/types/admin-national";

type LooseRow = Record<string, unknown>;

interface ResourceSpec {
  readonly title: string;
  readonly description: string;
  readonly table: string;
  readonly sourceLabel: string;
  readonly select: string;
  readonly titleKey: string;
  readonly columns: readonly AdminNationalColumn[];
  readonly orderBy?: string;
  readonly hasArchivedAt?: boolean;
  readonly statusKey?: string;
  readonly ideaFilter?: boolean;
}

const LIMIT = 100;

const resourceSpecs: Readonly<Record<string, ResourceSpec>> = {
  properties: {
    title: "Biens gérés",
    description: "Vue nationale du patrimoine actif enregistré dans GERIMMO.",
    table: "biens",
    sourceLabel: "biens",
    select:
      "id,organization_id,reference,name,type,status,address_line1,postal_code,city,surface_m2,rooms,monthly_rent_cents,monthly_charges_cents,created_at",
    titleKey: "name",
    statusKey: "status",
    hasArchivedAt: true,
    columns: [
      { key: "reference", label: "Référence" },
      { key: "type", label: "Type" },
      { key: "status", label: "Statut", format: "status" },
      { key: "city", label: "Ville" },
      { key: "surface_m2", label: "Surface" },
      { key: "monthly_rent_cents", label: "Loyer", format: "money" },
      { key: "created_at", label: "Créé le", format: "date" },
    ],
  },
  incidents: {
    title: "Incidents",
    description: "Tous les dossiers incidents du réseau, classés par dernière activité.",
    table: "incidents",
    sourceLabel: "incidents",
    select: "id,organization_id,number,category,subcategory,description,priority,status,created_at,updated_at",
    titleKey: "number",
    statusKey: "status",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "category", label: "Catégorie" },
      { key: "priority", label: "Priorité", format: "status" },
      { key: "status", label: "Statut", format: "status" },
      { key: "description", label: "Description" },
      { key: "updated_at", label: "Dernière activité", format: "date" },
    ],
  },
  quotes: {
    title: "Devis et validations",
    description: "Demandes de devis ouvertes et historiques de traitement du réseau.",
    table: "incident_quote_requests",
    sourceLabel: "demandes de devis",
    select: "id,organization_id,title,description,status,sent_at,expires_at,created_at,updated_at",
    titleKey: "title",
    statusKey: "status",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "status", label: "Statut", format: "status" },
      { key: "sent_at", label: "Envoyé le", format: "date" },
      { key: "expires_at", label: "Expiration", format: "date" },
      { key: "updated_at", label: "Dernière activité", format: "date" },
    ],
  },
  interventions: {
    title: "Interventions",
    description: "Suivi national des interventions planifiées et exécutées.",
    table: "incident_interventions",
    sourceLabel: "interventions",
    select:
      "id,organization_id,incident_id,status,execution_mode,planned_starts_at,planned_ends_at,actual_starts_at,actual_ends_at,work_description,planned_amount_cents,final_amount_cents,created_at,updated_at",
    titleKey: "id",
    statusKey: "status",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "execution_mode", label: "Mode" },
      { key: "status", label: "Statut", format: "status" },
      { key: "planned_starts_at", label: "Planifiée le", format: "date" },
      { key: "planned_amount_cents", label: "Montant prévu", format: "money" },
      { key: "final_amount_cents", label: "Montant final", format: "money" },
    ],
  },
  documents: {
    title: "Documents",
    description: "Bibliothèque documentaire nationale, sans exposition des fichiers confidentiels.",
    table: "documents",
    sourceLabel: "documents",
    select:
      "id,organization_id,title,reference,document_type,status,visibility,current_version,official_document,expires_at,created_at,updated_at",
    titleKey: "title",
    statusKey: "status",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "document_type", label: "Type" },
      { key: "status", label: "Statut", format: "status" },
      { key: "visibility", label: "Visibilité" },
      { key: "current_version", label: "Version" },
      { key: "expires_at", label: "Expiration", format: "date" },
    ],
  },
  messages: {
    title: "Échanges",
    description: "Conversations ouvertes dans les organisations GERIMMO.",
    table: "communication_conversations",
    sourceLabel: "conversations",
    select: "id,organization_id,subject,conversation_type,last_message_at,created_at,updated_at",
    titleKey: "subject",
    hasArchivedAt: true,
    orderBy: "last_message_at",
    columns: [
      { key: "conversation_type", label: "Type", format: "status" },
      { key: "last_message_at", label: "Dernier message", format: "date" },
      { key: "created_at", label: "Créée le", format: "date" },
    ],
  },
  notifications: {
    title: "Notifications",
    description: "Notifications applicatives émises sur l’ensemble du réseau.",
    table: "communication_notifications",
    sourceLabel: "notifications",
    select: "id,organization_id,title,body,notification_type,priority,read_at,created_at",
    titleKey: "title",
    statusKey: "priority",
    hasArchivedAt: true,
    columns: [
      { key: "notification_type", label: "Type" },
      { key: "priority", label: "Priorité", format: "status" },
      { key: "read_at", label: "Lue le", format: "date" },
      { key: "created_at", label: "Émise le", format: "date" },
    ],
  },
  reports: {
    title: "Rapports",
    description: "Rapports d’intervention générés et validés dans GERIMMO.",
    table: "incident_intervention_reports",
    sourceLabel: "rapports d’intervention",
    select: "id,organization_id,report_reference,status,generated_at,validated_at,created_at,updated_at",
    titleKey: "report_reference",
    statusKey: "status",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "status", label: "Statut", format: "status" },
      { key: "generated_at", label: "Généré le", format: "date" },
      { key: "validated_at", label: "Validé le", format: "date" },
      { key: "updated_at", label: "Dernière activité", format: "date" },
    ],
  },
  support: {
    title: "Support clients",
    description: "Demandes de support et signalements transmis au Centre Qualité.",
    table: "quality_reports",
    sourceLabel: "demandes de support",
    select: "id,organization_id,reference,title,description,priority,status,screen_path,created_at,updated_at",
    titleKey: "title",
    statusKey: "status",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "priority", label: "Priorité", format: "status" },
      { key: "status", label: "Statut", format: "status" },
      { key: "screen_path", label: "Écran" },
      { key: "updated_at", label: "Dernière activité", format: "date" },
    ],
  },
  ideas: {
    title: "Boîte à idées",
    description: "Suggestions utilisateurs identifiées dans les retours du Centre Qualité.",
    table: "quality_reports",
    sourceLabel: "suggestions",
    select: "id,organization_id,reference,title,description,priority,status,created_at,updated_at",
    titleKey: "title",
    statusKey: "status",
    hasArchivedAt: true,
    ideaFilter: true,
    orderBy: "updated_at",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "priority", label: "Priorité", format: "status" },
      { key: "status", label: "Statut", format: "status" },
      { key: "created_at", label: "Proposée le", format: "date" },
    ],
  },
  automations: {
    title: "Automatisations",
    description: "Événements automatisés et état de leur traitement.",
    table: "automation_events",
    sourceLabel: "événements d’automatisation",
    select:
      "id,organization_id,event_type,aggregate_type,status,available_at,processed_at,attempts,last_error,created_at",
    titleKey: "event_type",
    statusKey: "status",
    columns: [
      { key: "aggregate_type", label: "Ressource" },
      { key: "status", label: "Statut", format: "status" },
      { key: "attempts", label: "Tentatives" },
      { key: "processed_at", label: "Traité le", format: "date" },
      { key: "last_error", label: "Dernière erreur" },
    ],
  },
  security: {
    title: "Sécurité",
    description: "Alertes de sécurité et de fiabilité nécessitant une surveillance.",
    table: "monitoring_alerts",
    sourceLabel: "alertes de surveillance",
    select:
      "id,organization_id,title,message,alert_type,severity,source,status,occurrence_count,last_seen_at,created_at",
    titleKey: "title",
    statusKey: "status",
    orderBy: "last_seen_at",
    columns: [
      { key: "severity", label: "Gravité", format: "status" },
      { key: "source", label: "Source" },
      { key: "status", label: "Statut", format: "status" },
      { key: "occurrence_count", label: "Occurrences" },
      { key: "last_seen_at", label: "Dernière détection", format: "date" },
    ],
  },
  settings: {
    title: "Paramètres globaux",
    description: "Identités et configurations de marque actives par organisation.",
    table: "organization_branding",
    sourceLabel: "configurations d’organisation",
    select:
      "id,organization_id,display_name,legal_name,branding_enabled,support_email,support_phone,city,primary_color,updated_at,created_at",
    titleKey: "display_name",
    statusKey: "branding_enabled",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "legal_name", label: "Raison sociale" },
      { key: "branding_enabled", label: "Personnalisation", format: "boolean" },
      { key: "support_email", label: "E-mail support" },
      { key: "city", label: "Ville" },
      { key: "updated_at", label: "Mis à jour le", format: "date" },
    ],
  },
  "document-templates": {
    title: "Modèles de documents",
    description: "Modèles officiels GERIMMO et modèles propres aux organisations.",
    table: "document_templates",
    sourceLabel: "modèles documentaires",
    select:
      "id,organization_id,name,template_key,description,template_type,official_scope,is_active,created_at,updated_at",
    titleKey: "name",
    statusKey: "is_active",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "template_key", label: "Clé" },
      { key: "template_type", label: "Type" },
      { key: "official_scope", label: "Portée" },
      { key: "is_active", label: "Actif", format: "boolean" },
      { key: "updated_at", label: "Mis à jour le", format: "date" },
    ],
  },
  roles: {
    title: "Rôles et permissions",
    description: "Rôles disponibles et périmètre d’autorisation associé.",
    table: "roles",
    sourceLabel: "rôles",
    select: "id,key,name,description,scope,is_system,created_at,updated_at",
    titleKey: "name",
    statusKey: "scope",
    hasArchivedAt: true,
    orderBy: "updated_at",
    columns: [
      { key: "key", label: "Clé" },
      { key: "scope", label: "Portée", format: "status" },
      { key: "is_system", label: "Rôle système", format: "boolean" },
      { key: "updated_at", label: "Mis à jour le", format: "date" },
    ],
  },
};

function toValue(value: unknown): AdminNationalValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return value === undefined ? null : JSON.stringify(value);
}

async function organizationNames(rows: readonly LooseRow[]) {
  const ids = [...new Set(rows.map((row) => row.organization_id).filter((id): id is string => typeof id === "string"))];
  if (ids.length === 0) return new Map<string, string>();

  const { data, error } = await createAdminClient().from("organizations").select("id,name").in("id", ids);
  if (error) throw error;
  return new Map(((data ?? []) as LooseRow[]).map((row) => [String(row.id), String(row.name)]));
}

function mapRows(
  rows: readonly LooseRow[],
  spec: ResourceSpec,
  names: ReadonlyMap<string, string>,
): AdminNationalRow[] {
  return rows.map((row) => {
    const id = String(row.id);
    const titleValue = row[spec.titleKey] ?? row.reference;
    let title = typeof titleValue === "string" && titleValue.trim() ? titleValue : "Sans intitulé";
    if (spec.table === "incident_interventions") title = `Intervention ${id.slice(0, 8).toUpperCase()}`;

    return {
      id,
      title,
      organizationName:
        typeof row.organization_id === "string" ? (names.get(row.organization_id) ?? "Organisation inconnue") : null,
      values: Object.fromEntries(spec.columns.map((column) => [column.key, toValue(row[column.key])])),
    };
  });
}

async function loadResource(section: string, spec: ResourceSpec): Promise<AdminNationalPayload> {
  const admin = createAdminClient();
  let query = admin
    .from(spec.table as never)
    .select(spec.select, { count: "exact" })
    .order(spec.orderBy ?? "created_at", { ascending: false })
    .limit(LIMIT);

  if (spec.hasArchivedAt) query = query.is("archived_at", null);
  if (spec.ideaFilter) query = query.or("title.ilike.%idée%,description.ilike.%suggestion%");

  const { data, error, count } = await query;
  if (error) throw error;
  const sourceRows = (data ?? []) as unknown as LooseRow[];
  const names = await organizationNames(sourceRows);
  const rows = mapRows(sourceRows, spec, names);

  return {
    section,
    title: spec.title,
    description: spec.description,
    sourceLabel: spec.sourceLabel,
    total: count ?? rows.length,
    shown: rows.length,
    columns: spec.columns,
    rows,
    statusKey: spec.statusKey,
  };
}

async function loadMembers(section: "users" | "contractors"): Promise<AdminNationalPayload> {
  const admin = createAdminClient();
  let query = admin
    .from("organization_members")
    .select("id,organization_id,profile_id,member_type,status,joined_at,created_at", { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (section === "contractors") query = query.eq("member_type", "contractor");

  const { data, error, count } = await query;
  if (error) throw error;
  const members = (data ?? []) as unknown as LooseRow[];
  const profileIds = [...new Set(members.map((row) => String(row.profile_id)))];
  const contractors = section === "contractors";
  const [{ data: profiles, error: profileError }, names, subscriptionsResult, interventionsResult] = await Promise.all([
    profileIds.length > 0
      ? admin.from("profiles").select("id,full_name,email,phone,updated_at").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    organizationNames(members),
    admin
      .from("organization_subscriptions" as never)
      .select("organization_id,status,updated_at")
      .order("updated_at", { ascending: false }),
    contractors && profileIds.length > 0
      ? admin
          .from("incident_interventions")
          .select("organization_id,artisan_profile_id,bien_id,incident_id")
          .in("artisan_profile_id", profileIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileError) throw profileError;
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  if (interventionsResult.error) throw interventionsResult.error;
  const profileMap = new Map(((profiles ?? []) as LooseRow[]).map((row) => [String(row.id), row]));
  const subscriptionMap = new Map<string, string>();
  for (const subscription of (subscriptionsResult.data ?? []) as unknown as LooseRow[]) {
    const organizationId = String(subscription.organization_id);
    if (!subscriptionMap.has(organizationId)) subscriptionMap.set(organizationId, String(subscription.status));
  }
  const interventions = (interventionsResult.data ?? []) as LooseRow[];
  const bienIds = [...new Set(interventions.map((row) => String(row.bien_id)))];
  const { data: occupants, error: occupantError } =
    contractors && bienIds.length > 0
      ? await admin
          .from("bien_occupants")
          .select("bien_id,profile_id")
          .in("bien_id", bienIds)
          .eq("occupant_type", "locataire")
          .is("archived_at", null)
      : { data: [], error: null };
  if (occupantError) throw occupantError;
  const tenantsByBien = new Map<string, Set<string>>();
  for (const occupant of (occupants ?? []) as LooseRow[]) {
    const bienId = String(occupant.bien_id);
    const tenants = tenantsByBien.get(bienId) ?? new Set<string>();
    tenants.add(String(occupant.profile_id));
    tenantsByBien.set(bienId, tenants);
  }
  const contractorStats = new Map<
    string,
    { readonly biens: Set<string>; readonly incidents: Set<string>; readonly tenants: Set<string> }
  >();
  for (const intervention of interventions) {
    const key = `${String(intervention.artisan_profile_id)}:${String(intervention.organization_id)}`;
    const stats = contractorStats.get(key) ?? {
      biens: new Set<string>(),
      incidents: new Set<string>(),
      tenants: new Set<string>(),
    };
    const bienId = String(intervention.bien_id);
    stats.biens.add(bienId);
    stats.incidents.add(String(intervention.incident_id));
    for (const tenantId of tenantsByBien.get(bienId) ?? []) stats.tenants.add(tenantId);
    contractorStats.set(key, stats);
  }
  const columns: AdminNationalColumn[] = [
    { key: "status", label: "Statut", format: "status" },
    { key: "subscription", label: "Abonnement", format: "status" },
    { key: "last_activity", label: "Dernière activité", format: "date" },
    { key: "properties_count", label: "Biens" },
    { key: "tenants_count", label: "Locataires" },
    { key: "incidents_count", label: "Incidents" },
  ];
  const rows = members.map((member): AdminNationalRow => {
    const profile = profileMap.get(String(member.profile_id)) ?? {};
    const organizationId = String(member.organization_id);
    const profileId = String(member.profile_id);
    const stats = contractorStats.get(`${profileId}:${organizationId}`);
    return {
      id: String(member.id),
      title: String(profile.full_name ?? profile.email ?? "Profil sans nom"),
      organizationName: names.get(organizationId) ?? "Organisation inconnue",
      values: {
        status: toValue(member.status),
        subscription: toValue(subscriptionMap.get(organizationId)),
        last_activity: toValue(profile.updated_at ?? member.joined_at),
        properties_count: stats?.biens.size ?? 0,
        tenants_count: stats?.tenants.size ?? 0,
        incidents_count: stats?.incidents.size ?? 0,
      },
      supervision: {
        type: contractors ? "contractor" : "user",
        targetId: profileId,
        organizationId,
      },
    };
  });
  return {
    section,
    title: contractors ? "Artisans" : "Utilisateurs",
    description: contractors
      ? "Artisans rattachés aux organisations du réseau GERIMMO."
      : "Comptes membres actifs ou invités dans toutes les organisations.",
    sourceLabel: contractors ? "artisans" : "utilisateurs",
    total: count ?? rows.length,
    shown: rows.length,
    columns,
    rows,
    statusKey: "status",
  };
}

async function loadAdministrators(): Promise<AdminNationalPayload> {
  const { data, error, count } = await createAdminClient()
    .from("profiles")
    .select("id,full_name,email,phone,created_at,updated_at", { count: "exact" })
    .eq("is_super_admin", true)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  const columns: AdminNationalColumn[] = [
    { key: "email", label: "E-mail" },
    { key: "phone", label: "Téléphone" },
    { key: "created_at", label: "Créé le", format: "date" },
    { key: "updated_at", label: "Mis à jour le", format: "date" },
  ];
  const rows = ((data ?? []) as LooseRow[]).map(
    (profile): AdminNationalRow => ({
      id: String(profile.id),
      title: String(profile.full_name ?? profile.email ?? "Administrateur"),
      organizationName: "GERIMMO",
      values: Object.fromEntries(columns.map((column) => [column.key, toValue(profile[column.key])])),
    }),
  );
  return {
    section: "administrators",
    title: "Administrateurs GERIMMO",
    description: "Comptes disposant d’un accès Super Admin à la plateforme.",
    sourceLabel: "administrateurs",
    total: count ?? rows.length,
    shown: rows.length,
    columns,
    rows,
  };
}

export const ADMIN_NATIONAL_SECTIONS = [
  "properties",
  "users",
  "incidents",
  "quotes",
  "interventions",
  "contractors",
  "documents",
  "messages",
  "notifications",
  "reports",
  "support",
  "ideas",
  "automations",
  "security",
  "settings",
  "document-templates",
  "roles",
  "administrators",
] as const;

export type AdminNationalSection = (typeof ADMIN_NATIONAL_SECTIONS)[number];

export function isAdminNationalSection(section: string): section is AdminNationalSection {
  return (ADMIN_NATIONAL_SECTIONS as readonly string[]).includes(section);
}

export async function getAdminNationalView(section: AdminNationalSection): Promise<AdminNationalPayload> {
  await requireSuperAdmin();
  if (section === "users" || section === "contractors") return loadMembers(section);
  if (section === "administrators") return loadAdministrators();

  const spec = resourceSpecs[section];
  if (!spec) throw new Error(`Vue Super Admin inconnue : ${section}`);
  return loadResource(section, spec);
}
