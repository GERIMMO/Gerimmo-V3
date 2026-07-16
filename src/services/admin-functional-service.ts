import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminFunctionalPayload, AdminMutationInput, AdminTableRow } from "@/types/admin-functional";

import { requireSuperAdmin } from "./administration-service";

type Row = Record<string, unknown>;

const titles: Record<string, [string, string]> = {
  subscriptions: ["Abonnements", "Gestion des abonnements et des cycles clients."],
  offers: ["Offres", "Catalogue commercial GERIMMO et performance par formule."],
  "promotion-codes": ["Codes promotionnels", "Avantages commerciaux, limites et utilisations."],
  revenue: ["Revenus", "Revenus encaissés, récurrence et évolution."],
  payments: ["Paiements", "Suivi des paiements, échecs et remboursements."],
  growth: ["Croissance", "Évolution du réseau et de l’activité GERIMMO."],
  usage: ["Utilisation", "Usage réel des modules de la plateforme."],
  acquisition: ["Acquisition", "Origine, essais et conversion des nouveaux clients."],
  retention: ["Fidélisation", "Renouvellements, résiliations et activité des comptes."],
  "user-requests": ["Demandes utilisateurs", "Traitement et historique des demandes adressées à GERIMMO."],
  bugs: ["Bugs signalés", "Analyse humaine assistée et décisions de correction."],
  ideas: ["Boîte à idées", "Votes, analyse et décisions produit."],
  "practical-information": ["Informations pratiques", "Informations ciblées visibles dans les portails concernés."],
  alerts: ["Alertes", "Alertes multicanales et confirmations de lecture."],
  "global-announcements": ["Annonces globales", "Publications nationales et historique complet."],
  "communication-templates": ["Modèles de communication", "Contenus réutilisables pour les communications GERIMMO."],
  "system-health": ["Santé GERIMMO", "État mesuré des services et incidents techniques."],
  bots: ["Bots", "Activité, conversations, erreurs et transferts."],
  automations: ["Automatisations", "Workflows, exécutions et relances."],
  communications: ["Communications", "Volumes et erreurs par canal."],
  integrations: ["Intégrations", "État réel des connexions externes."],
  "technical-log": ["Journal technique", "Événements corrélés de la plateforme."],
  security: ["Sécurité", "Connexions, sessions, permissions et actions sensibles."],
  "ai-center": ["Centre IA", "Recommandations Codex soumises à validation humaine."],
};

function client(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function relationCount(value: unknown): number {
  if (!Array.isArray(value) || value.length === 0) return 0;
  return number((value[0] as Row).count);
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function healthTone(value: number): "success" | "warning" | "danger" {
  if (value >= 90) return "success";
  if (value >= 60) return "warning";
  return "danger";
}

function tableRow(row: Row): AdminTableRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(String) : (value as string | number | boolean | null),
    ]),
  ) as AdminTableRow;
}

async function queryOptions(admin: SupabaseClient) {
  const [organizations, plans, profiles] = await Promise.all([
    admin.from("organizations").select("id,name").is("archived_at", null).order("name"),
    admin.from("subscription_plans").select("id,name").is("archived_at", null).order("name"),
    admin.from("profiles").select("id,full_name,email").is("archived_at", null).order("full_name").limit(500),
  ]);
  return {
    organizations: asRows(organizations.data).map((row) => ({ id: text(row.id), name: text(row.name) })),
    plans: asRows(plans.data).map((row) => ({ id: text(row.id), name: text(row.name) })),
    profiles: asRows(profiles.data).map((row) => ({
      id: text(row.id),
      name: text(row.full_name) || text(row.email),
    })),
  };
}

async function businessPayload(section: string, admin: SupabaseClient): Promise<AdminFunctionalPayload> {
  const [subscriptions, plans, promotions, payments, invoices, refunds, organizations] = await Promise.all([
    admin
      .from("organization_subscriptions")
      .select("*,organizations(name,organization_type),subscription_plans(name,amount_cents,billing_interval)")
      .order("created_at", { ascending: false }),
    admin.from("subscription_plans").select("*").is("archived_at", null).order("amount_cents"),
    admin.from("promotion_codes").select("*").is("archived_at", null).order("created_at", { ascending: false }),
    admin.from("billing_payments").select("*,organizations(name)").order("created_at", { ascending: false }).limit(500),
    admin
      .from("billing_invoices")
      .select("*,organizations(name)")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin.from("billing_refunds").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("organizations").select("id,name,organization_type").is("archived_at", null),
  ]);
  for (const result of [subscriptions, plans, promotions, payments, invoices, refunds, organizations]) {
    if (result.error) throw result.error;
  }
  const subscriptionRows = asRows(subscriptions.data);
  const planRows = asRows(plans.data);
  const promotionRows = asRows(promotions.data);
  const paymentRows = asRows(payments.data);
  const invoiceRows = asRows(invoices.data);
  const refundRows = asRows(refunds.data);
  const paidInvoices = invoiceRows.filter((row) => row.status === "paid");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthly = paidInvoices.filter((row) => text(row.paid_at) && new Date(text(row.paid_at)) >= monthStart);
  const yearly = paidInvoices.filter((row) => text(row.paid_at) && new Date(text(row.paid_at)) >= yearStart);
  const monthlyCents = monthly.reduce((sum, row) => sum + number(row.total_cents), 0);
  const yearlyCents = yearly.reduce((sum, row) => sum + number(row.total_cents), 0);
  let rows: AdminTableRow[] = [];
  let metrics = [];
  if (section === "subscriptions") {
    rows = subscriptionRows.map((row) =>
      tableRow({
        id: row.id,
        organization_id: row.organization_id,
        organisation: (row.organizations as Row | null)?.name ?? "Organisation",
        type: (row.organizations as Row | null)?.organization_type ?? "",
        formule: (row.subscription_plans as Row | null)?.name ?? row.plan_key,
        plan_id: row.plan_id,
        statut: row.status,
        essai_fin: row.trial_ends_at,
        renouvellement: row.current_period_end,
        updated_at: row.updated_at,
      }),
    );
    metrics = [
      {
        label: "Actifs",
        value: subscriptionRows.filter((row) => row.status === "active").length,
        tone: "success" as const,
      },
      { label: "Essais gratuits", value: subscriptionRows.filter((row) => row.status === "trial").length },
      { label: "Résiliés", value: subscriptionRows.filter((row) => row.status === "cancelled").length },
      {
        label: "Renouvellements",
        value: subscriptionRows.filter((row) => text(row.current_period_end) >= now.toISOString()).length,
      },
      {
        label: "Paiements échoués",
        value: paymentRows.filter((row) => row.status === "failed").length,
        tone: "danger" as const,
      },
      {
        label: "Suspendus",
        value: subscriptionRows.filter((row) => row.status === "suspended").length,
        tone: "warning" as const,
      },
    ];
  } else if (section === "offers") {
    rows = planRows.map((plan) => {
      const clients = subscriptionRows.filter((subscription) => subscription.plan_id === plan.id);
      const revenue = paidInvoices
        .filter((invoice) => clients.some((subscription) => subscription.id === invoice.subscription_id))
        .reduce((sum, invoice) => sum + number(invoice.total_cents), 0);
      return tableRow({
        id: plan.id,
        nom: plan.name,
        audience: plan.audience,
        intervalle: plan.billing_interval,
        prix_cents: plan.amount_cents,
        clients: clients.length,
        revenu_cents: revenue,
        conversion: clients.length
          ? Math.round((clients.filter((item) => item.status === "active").length / clients.length) * 1000) / 10
          : 0,
        evolution: clients.filter((item) => text(item.created_at) >= monthStart.toISOString()).length,
        active: plan.is_active,
      });
    });
    metrics = [
      { label: "Offres actives", value: planRows.filter((row) => row.is_active).length },
      { label: "Clients rattachés", value: subscriptionRows.length },
      { label: "Offres sur devis", value: planRows.filter((row) => row.requires_quote).length },
    ];
  } else if (section === "promotion-codes") {
    rows = promotionRows.map((row) =>
      tableRow({
        id: row.id,
        code: row.code,
        description: row.campaign,
        type: row.discount_type,
        valeur: row.discount_value,
        debut: row.starts_at,
        fin: row.expires_at,
        limite: row.max_redemptions,
        utilisations: row.redemption_count,
        statut: row.is_active ? "active" : "suspended",
        plan_ids: row.applicable_plan_ids,
      }),
    );
    metrics = [
      { label: "Codes actifs", value: promotionRows.filter((row) => row.is_active).length },
      { label: "Utilisations", value: promotionRows.reduce((sum, row) => sum + number(row.redemption_count), 0) },
      { label: "Codes suspendus", value: promotionRows.filter((row) => !row.is_active).length },
    ];
  } else if (section === "revenue") {
    rows = paidInvoices.map((row) =>
      tableRow({
        id: row.id,
        organisation: (row.organizations as Row | null)?.name ?? "Organisation",
        numero: row.number,
        montant_cents: row.total_cents,
        paye_le: row.paid_at,
        periode_debut: row.period_start,
        periode_fin: row.period_end,
      }),
    );
    const mrr = subscriptionRows.reduce((sum, row) => {
      if (row.status !== "active") return sum;
      const plan = row.subscription_plans as Row | null;
      const amount = number(plan?.amount_cents);
      return sum + (plan?.billing_interval === "annual" ? Math.round(amount / 12) : amount);
    }, 0);
    metrics = [
      { label: "MRR", value: mrr, suffix: "cents" },
      { label: "ARR", value: mrr * 12, suffix: "cents" },
      { label: "Revenu mensuel", value: monthlyCents, suffix: "cents" },
      { label: "Revenu annuel", value: yearlyCents, suffix: "cents" },
      {
        label: "Pertes par résiliation",
        value: subscriptionRows
          .filter((row) => row.status === "cancelled")
          .reduce((sum, row) => sum + number((row.subscription_plans as Row | null)?.amount_cents), 0),
        suffix: "cents",
        tone: "warning" as const,
      },
    ];
  } else {
    rows = paymentRows.map((row) =>
      tableRow({
        id: row.id,
        organisation: (row.organizations as Row | null)?.name ?? "Organisation",
        statut: row.status,
        montant_cents: row.amount_cents,
        devise: row.currency,
        erreur: row.failure_message,
        paye_le: row.paid_at,
        created_at: row.created_at,
      }),
    );
    metrics = [
      {
        label: "Réussis",
        value: paymentRows.filter((row) => row.status === "succeeded").length,
        tone: "success" as const,
      },
      { label: "Échoués", value: paymentRows.filter((row) => row.status === "failed").length, tone: "danger" as const },
      {
        label: "En attente",
        value: paymentRows.filter((row) => row.status === "pending").length,
        tone: "warning" as const,
      },
      { label: "Remboursements", value: refundRows.filter((row) => row.status === "succeeded").length },
    ];
  }
  const [title, description] = titles[section];
  let secondaryRows: AdminTableRow[] | undefined;
  if (section === "revenue") {
    secondaryRows = Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - offset), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      const value = paidInvoices
        .filter((row) => text(row.paid_at) && new Date(text(row.paid_at)) >= date && new Date(text(row.paid_at)) < end)
        .reduce((sum, row) => sum + number(row.total_cents), 0);
      return tableRow({
        id: date.toISOString(),
        label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date),
        value,
      });
    });
  }
  return { section, title, description, metrics, rows, secondaryRows, options: await queryOptions(admin) };
}

function periodCount(rows: Row[], key: string, start: Date, end: Date): number {
  return rows.filter((row) => {
    const value = text(row[key]);
    if (!value) return false;
    const date = new Date(value);
    return date >= start && date < end;
  }).length;
}

async function analyticsPayload(section: string, admin: SupabaseClient): Promise<AdminFunctionalPayload> {
  const since = new Date(new Date().getFullYear() - 1, 0, 1).toISOString();
  const requests = [
    admin.from("organizations").select("id,organization_type,created_at").gte("created_at", since),
    admin.from("biens").select("id,created_at").gte("created_at", since),
    admin.from("profiles").select("id,created_at").gte("created_at", since),
    admin.from("incidents").select("id,created_at").gte("created_at", since),
    admin.from("documents").select("id,created_at").gte("created_at", since),
    admin.from("incident_interventions").select("id,created_at").gte("created_at", since),
    admin.from("bot_messages").select("id,created_at").gte("created_at", since),
    admin.from("organization_subscriptions").select("id,status,created_at,cancelled_at"),
    admin.from("billing_invoices").select("id,total_cents,status,paid_at").gte("created_at", since),
    admin.from("marketing_events").select("id,event_type,occurred_at").gte("occurred_at", since),
  ];
  const results = await Promise.all(requests);
  for (const result of results) if (result.error) throw result.error;
  const [
    organizations,
    properties,
    profiles,
    incidents,
    documents,
    interventions,
    botMessages,
    subscriptions,
    invoices,
    marketing,
  ] = results.map((result) => asRows(result.data));
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentWeek = new Date(now);
  currentWeek.setHours(0, 0, 0, 0);
  currentWeek.setDate(currentWeek.getDate() - ((currentWeek.getDay() + 6) % 7));
  const previousWeek = new Date(currentWeek.getTime() - 7 * 86400000);
  const currentYear = new Date(now.getFullYear(), 0, 1);
  const previousYear = new Date(now.getFullYear() - 1, 0, 1);
  const datasets = [
    ["Nouvelles agences", organizations.filter((row) => row.organization_type === "agency"), "created_at"],
    [
      "Nouveaux propriétaires",
      organizations.filter((row) => row.organization_type === "independent_owner"),
      "created_at",
    ],
    ["Nouveaux biens", properties, "created_at"],
    ["Nouveaux utilisateurs", profiles, "created_at"],
    ["Incidents", incidents, "created_at"],
    ["Documents", documents, "created_at"],
    ["Interventions", interventions, "created_at"],
    ["Utilisation du Bot", botMessages, "created_at"],
  ] as const;
  const rows = datasets.map(([label, data, key], index) =>
    tableRow({
      id: String(index),
      indicateur: label,
      semaine: periodCount(data, key, currentWeek, now),
      semaine_precedente: periodCount(data, key, previousWeek, currentWeek),
      mois: periodCount(data, key, currentMonth, nextMonth),
      mois_precedent: periodCount(data, key, previousMonth, currentMonth),
      annee: periodCount(data, key, currentYear, now),
      annee_precedente: periodCount(data, key, previousYear, currentYear),
      periode_actuelle: periodCount(data, key, currentMonth, nextMonth),
      periode_precedente: periodCount(data, key, previousMonth, currentMonth),
    }),
  );
  const paid = invoices.filter((row) => row.status === "paid");
  const currentRevenue = paid
    .filter((row) => text(row.paid_at) && new Date(text(row.paid_at)) >= currentMonth)
    .reduce((sum, row) => sum + number(row.total_cents), 0);
  const previousRevenue = paid
    .filter(
      (row) =>
        text(row.paid_at) && new Date(text(row.paid_at)) >= previousMonth && new Date(text(row.paid_at)) < currentMonth,
    )
    .reduce((sum, row) => sum + number(row.total_cents), 0);
  const [title, description] = titles[section];
  return {
    section,
    title,
    description,
    metrics: [
      { label: "Éléments ce mois", value: rows.reduce((sum, row) => sum + number(row.periode_actuelle), 0) },
      { label: "Éléments mois précédent", value: rows.reduce((sum, row) => sum + number(row.periode_precedente), 0) },
      { label: "Revenu ce mois", value: currentRevenue, suffix: "cents" },
      { label: "Revenu mois précédent", value: previousRevenue, suffix: "cents" },
      { label: "Abonnements actifs", value: subscriptions.filter((row) => row.status === "active").length },
      { label: "Conversions suivies", value: marketing.filter((row) => row.event_type === "conversion").length },
    ],
    rows,
  };
}

async function supportPayload(section: string, admin: SupabaseClient): Promise<AdminFunctionalPayload> {
  let table = "product_ideas";
  let selection =
    "*,profiles:author_profile_id(full_name,email),product_idea_votes(count),product_idea_comments(count)";
  if (section === "user-requests") {
    table = "admin_support_requests";
    selection =
      "*,organizations(name),requester:profiles!requester_profile_id(full_name,email),assigned:profiles!assigned_profile_id(full_name),admin_support_events(action,note,created_at)";
  } else if (section === "bugs") {
    table = "quality_reports";
    selection =
      "*,profiles:reporter_profile_id(full_name,email),quality_attachments(file_name,storage_path),quality_analyses(*),correction_proposals(*)";
  }
  const result = await admin
    .from(table)
    .select(selection)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (result.error) throw result.error;
  const source = asRows(result.data);
  const rows = source.map((row) => {
    if (section === "user-requests")
      return tableRow({
        id: row.id,
        nom: (row.requester as Row | null)?.full_name ?? (row.requester as Row | null)?.email ?? "Utilisateur",
        role: "Utilisateur GERIMMO",
        agence: (row.organizations as Row | null)?.name ?? "Hors organisation",
        sujet: row.subject,
        priorite: row.priority,
        date: row.created_at,
        statut: row.status,
        responsable: (row.assigned as Row | null)?.full_name ?? "Non attribué",
        assigned_profile_id: row.assigned_profile_id,
        description: row.description,
        historique: Array.isArray(row.admin_support_events)
          ? row.admin_support_events.map((event) => {
              const item = event as Row;
              return `${text(item.created_at)} · ${text(item.action)}${item.note ? ` · ${text(item.note)}` : ""}`;
            })
          : [],
      });
    if (section === "bugs") {
      const analysis = Array.isArray(row.quality_analyses)
        ? (row.quality_analyses[0] as Row | undefined)
        : (row.quality_analyses as Row | null);
      const proposal = Array.isArray(row.correction_proposals)
        ? (row.correction_proposals[0] as Row | undefined)
        : (row.correction_proposals as Row | null);
      return tableRow({
        id: row.id,
        reference: row.reference,
        utilisateur: (row.profiles as Row | null)?.full_name ?? (row.profiles as Row | null)?.email ?? "Utilisateur",
        page: row.screen_path,
        description: row.description,
        date: row.created_at,
        priorite: row.priority,
        statut: row.status,
        cause_probable: analysis?.probable_cause ?? null,
        fichiers: (analysis?.affected_files as string[] | undefined) ?? [],
        correction: proposal?.changes ?? null,
        consequences: proposal?.positive_outcomes ?? null,
        risque: proposal?.risks ?? null,
        tests: (proposal?.planned_tests as string[] | undefined) ?? [],
        proposal_id: proposal?.id ?? null,
        captures: Array.isArray(row.quality_attachments)
          ? row.quality_attachments.map((attachment) => text((attachment as Row).file_name))
          : [],
      });
    }
    return tableRow({
      id: row.id,
      titre: row.title,
      auteur: (row.profiles as Row | null)?.full_name ?? (row.profiles as Row | null)?.email ?? "Utilisateur",
      date: row.created_at,
      votes: relationCount(row.product_idea_votes),
      commentaires: relationCount(row.product_idea_comments),
      popularite: row.popularity_score,
      difficulte: row.estimated_difficulty,
      temps: row.estimated_minutes,
      valeur: row.added_value,
      evolution: row.codex_evolution,
      recommandation: row.codex_recommendation,
      statut: row.status,
      description: row.description,
    });
  });
  const [title, description] = titles[section];
  return {
    section,
    title,
    description,
    metrics: [
      { label: "Total", value: source.length },
      {
        label: "À traiter",
        value: source.filter((row) => ["new", "submitted"].includes(text(row.status))).length,
        tone: "warning",
      },
      {
        label: "En cours",
        value: source.filter((row) => ["in_progress", "analyzing", "reviewing"].includes(text(row.status))).length,
      },
      {
        label: "Critiques",
        value: source.filter((row) => ["critical", "urgent"].includes(text(row.priority))).length,
        tone: "danger",
      },
    ],
    rows,
    options: await queryOptions(admin),
  };
}

async function communicationPayload(section: string, admin: SupabaseClient): Promise<AdminFunctionalPayload> {
  if (section === "articles") throw new Error("Les articles utilisent leur module dédié.");
  let kind = "announcement";
  if (section === "practical-information") kind = "practical_info";
  else if (section === "alerts") kind = "alert";
  const result =
    section === "communication-templates"
      ? await admin
          .from("admin_communication_templates")
          .select("*")
          .is("archived_at", null)
          .order("created_at", { ascending: false })
      : await admin
          .from("admin_communications")
          .select("*,organizations(name)")
          .eq("kind", kind)
          .is("archived_at", null)
          .order("created_at", { ascending: false });
  if (result.error) throw result.error;
  const source = asRows(result.data);
  const rows = source.map((row) =>
    section === "communication-templates"
      ? tableRow({
          id: row.id,
          nom: row.name,
          categorie: row.category,
          sujet: row.subject,
          contenu: row.body,
          canaux: row.default_channels,
          statut: row.is_active ? "active" : "suspended",
          updated_at: row.updated_at,
        })
      : tableRow({
          id: row.id,
          titre: row.title,
          message: row.message,
          niveau: row.severity,
          audience: row.audience_type,
          organisation: (row.organizations as Row | null)?.name ?? null,
          canaux: row.channels,
          statut: row.status,
          debut: row.starts_at,
          fin: row.ends_at,
          lecture_obligatoire: row.requires_acknowledgement,
          updated_at: row.updated_at,
        }),
  );
  const [title, description] = titles[section];
  return {
    section,
    title,
    description,
    metrics: [
      { label: "Total", value: source.length },
      {
        label: "Publiés",
        value: source.filter((row) => row.status === "published" || row.is_active === true).length,
        tone: "success",
      },
      { label: "Programmés", value: source.filter((row) => row.status === "scheduled").length },
      { label: "Archivés", value: source.filter((row) => row.status === "archived" || row.is_active === false).length },
    ],
    rows,
    options: await queryOptions(admin),
  };
}

async function systemPayload(section: string, admin: SupabaseClient): Promise<AdminFunctionalPayload> {
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const [
    events,
    alerts,
    integrations,
    workflows,
    botMessages,
    botErrors,
    conversations,
    automationEvents,
    notifications,
    sessions,
    permissions,
    userDetails,
    members,
    auditLogs,
  ] = await Promise.all([
    admin
      .from("observability_events")
      .select("*")
      .gte("occurred_at", dayAgo)
      .order("occurred_at", { ascending: false })
      .limit(1000),
    admin.from("monitoring_alerts").select("*").order("last_seen_at", { ascending: false }).limit(300),
    admin.from("system_integrations").select("*").order("name"),
    admin.from("automation_workflows").select("*").is("archived_at", null).order("name"),
    admin.from("bot_messages").select("id,direction,created_at").gte("created_at", dayAgo),
    admin.from("bot_errors").select("id,error_code,resolved_at,created_at").gte("created_at", dayAgo),
    admin.from("bot_conversations").select("id,organization_id,status,updated_at"),
    admin
      .from("automation_events")
      .select("id,event_type,status,attempts,last_error,created_at,processed_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("communication_notifications").select("id,notification_type,created_at").gte("created_at", dayAgo),
    admin
      .from("user_activity_logs")
      .select("id,action,created_at,profile_id")
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("role_permissions").select("id"),
    admin.from("user_profile_details").select("id,profile_id,last_seen_at").is("archived_at", null),
    admin.from("organization_members").select("id,profile_id,status").in("status", ["active", "suspended"]),
    admin
      .from("audit_logs")
      .select("id,actor_profile_id,action,table_name,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  for (const result of [
    events,
    alerts,
    integrations,
    workflows,
    botMessages,
    botErrors,
    conversations,
    automationEvents,
    notifications,
    sessions,
    permissions,
    userDetails,
    members,
    auditLogs,
  ])
    if (result.error) throw result.error;
  const eventRows = asRows(events.data);
  const alertRows = asRows(alerts.data);
  const integrationRows = asRows(integrations.data);
  const workflowRows = asRows(workflows.data);
  const botErrorRows = asRows(botErrors.data);
  const bucketResult = await admin.storage.listBuckets();
  const derivedIntegrations: Row[] = [
    { code: "supabase", name: "Supabase", category: "Données", status: "operational" },
    {
      code: "vercel",
      name: "Vercel",
      category: "Application",
      status: process.env.VERCEL_ENV ? "operational" : "not_configured",
    },
    {
      code: "stripe",
      name: "Stripe",
      category: "Paiements",
      status: process.env.STRIPE_SECRET_KEY ? "operational" : "not_configured",
    },
    {
      code: "whatsapp",
      name: "WhatsApp",
      category: "Communication",
      status: process.env.WHATSAPP_ACCESS_TOKEN ? "operational" : "not_configured",
    },
    {
      code: "telegram",
      name: "Telegram",
      category: "Communication",
      status: process.env.TELEGRAM_BOT_TOKEN ? "operational" : "not_configured",
    },
    {
      code: "email",
      name: "Emails",
      category: "Communication",
      status: process.env.RESEND_API_KEY || process.env.SMTP_HOST ? "operational" : "not_configured",
    },
    {
      code: "storage",
      name: "Stockage",
      category: "Documents",
      status: bucketResult.error ? "degraded" : "operational",
      last_error: bucketResult.error?.message ?? null,
    },
    {
      code: "pdf",
      name: "PDF",
      category: "Documents",
      status: eventRows.some((row) => row.module === "pdf" && ["error", "critical"].includes(text(row.severity)))
        ? "degraded"
        : "operational",
    },
    {
      code: "n8n",
      name: "n8n",
      category: "Automatisation",
      status: process.env.N8N_WEBHOOK_URL || process.env.N8N_BASE_URL ? "operational" : "not_configured",
    },
  ].map((derived) => integrationRows.find((row) => row.code === derived.code) ?? derived);
  let rows: AdminTableRow[];
  if (section === "system-health") {
    const sources = [
      "application",
      "supabase",
      "authentication",
      "storage",
      "email",
      "whatsapp",
      "telegram",
      "n8n",
      "payments",
      "pdf",
      "api",
    ];
    rows = sources.map((source) => {
      const integration = integrationRows.find((row) => row.code === source);
      const sourceEvents = eventRows.filter(
        (row) => row.source === source || (source === "application" && row.source === "browser"),
      );
      const errors = sourceEvents.filter((row) => ["error", "critical"].includes(text(row.severity))).length;
      let status = integration?.status ?? "not_configured";
      if (!integration && source !== "whatsapp" && errors) status = "degraded";
      else if (!integration && source !== "whatsapp" && sourceEvents.length) status = "operational";
      return tableRow({
        id: source,
        service: source,
        statut: status,
        erreurs_24h: errors,
        derniere_verification: integration?.last_checked_at ?? null,
        detail: integration?.last_error ?? null,
      });
    });
  } else if (section === "bots") {
    rows = [
      tableRow({
        id: "telegram",
        bot: "Telegram",
        statut: process.env.TELEGRAM_BOT_TOKEN ? "active" : "not_configured",
        conversations: asRows(conversations.data).length,
        messages_24h: asRows(botMessages.data).length,
        erreurs_24h: botErrorRows.length,
        demandes_transferees: asRows(botMessages.data).filter((row) => row.direction === "outbound").length,
        temps_moyen_ms: average(
          eventRows
            .filter((row) => row.source === "telegram")
            .map((row) => number(row.duration_ms))
            .filter(Boolean),
        ),
        agences_utilisatrices: new Set(
          asRows(conversations.data)
            .map((row) => text(row.organization_id))
            .filter(Boolean),
        ).size,
      }),
    ];
  } else if (section === "automations") {
    rows = workflowRows.length
      ? workflowRows.map((row) => tableRow({ ...row, retryable: true }))
      : asRows(automationEvents.data).map((row) =>
          tableRow({
            id: row.id,
            nom: row.event_type,
            statut: row.status,
            derniere_execution: row.processed_at ?? row.created_at,
            prochaine_execution: null,
            erreurs: row.last_error,
            tentatives: row.attempts,
            retryable: false,
          }),
        );
  } else if (section === "communications") {
    const messageRows = asRows(botMessages.data);
    const notificationRows = asRows(notifications.data);
    rows = [
      tableRow({
        id: "email",
        canal: "Email",
        volume_24h: eventRows.filter((row) => row.source === "email").length,
        erreurs_24h: eventRows.filter(
          (row) => row.source === "email" && ["error", "critical"].includes(text(row.severity)),
        ).length,
      }),
      tableRow({ id: "notification", canal: "Notifications", volume_24h: notificationRows.length, erreurs_24h: 0 }),
      tableRow({ id: "whatsapp", canal: "WhatsApp", volume_24h: 0, erreurs_24h: 0 }),
      tableRow({ id: "telegram", canal: "Telegram", volume_24h: messageRows.length, erreurs_24h: botErrorRows.length }),
      tableRow({
        id: "internal",
        canal: "Messages internes",
        volume_24h: eventRows.filter((row) => row.module === "communication").length,
        erreurs_24h: 0,
      }),
    ];
  } else if (section === "integrations") {
    rows = derivedIntegrations.map((row) => tableRow({ id: row.id ?? row.code, ...row, persistent: Boolean(row.id) }));
  } else if (section === "technical-log") {
    rows = eventRows.map((row) =>
      tableRow({
        id: row.id,
        source: row.source,
        niveau: row.severity,
        module: row.module,
        message: row.message,
        duree_ms: row.duration_ms,
        statut_http: row.status_code,
        date: row.occurred_at,
        correlation: row.correlation_id,
      }),
    );
  } else {
    const connectionRows = asRows(sessions.data).filter(
      (row) => text(row.action).toLowerCase().includes("login") || text(row.action).toLowerCase().includes("connexion"),
    );
    const sensitiveRows = asRows(auditLogs.data).filter((row) =>
      /DELETE|ARCHIVE|SUSPEND|ROLE|PERMISSION|SUPERVISION/.test(text(row.action)),
    );
    rows = [
      ...connectionRows.map((row) =>
        tableRow({
          id: row.id,
          categorie: "Connexion",
          action: row.action,
          utilisateur: row.profile_id,
          date: row.created_at,
        }),
      ),
      ...sensitiveRows.map((row) =>
        tableRow({
          id: row.id,
          categorie: "Action sensible",
          action: row.action,
          utilisateur: row.actor_profile_id,
          date: row.created_at,
        }),
      ),
    ];
  }
  const [title, description] = titles[section];
  const openAlerts = alertRows.filter((row) => row.status === "open");
  const healthPercent = Math.max(
    0,
    Math.round(
      derivedIntegrations.reduce((sum, row) => {
        if (row.status === "operational") return sum + 100;
        if (row.status === "degraded") return sum + 50;
        return sum;
      }, 0) / derivedIntegrations.length,
    ),
  );
  return {
    section,
    title,
    description,
    metrics: [
      { label: "Santé GERIMMO", value: healthPercent, suffix: "%", tone: healthTone(healthPercent) },
      {
        label: "Erreurs sur 24 h",
        value: eventRows.filter((row) => ["error", "critical"].includes(text(row.severity))).length,
        tone: "danger",
      },
      { label: "Alertes ouvertes", value: openAlerts.length, tone: "warning" },
      {
        label: "Intégrations opérationnelles",
        value: derivedIntegrations.filter((row) => row.status === "operational").length,
        tone: "success",
      },
      { label: "Permissions attribuées", value: asRows(permissions.data).length },
      {
        label: "Comptes suspendus",
        value: asRows(members.data).filter((row) => row.status === "suspended").length,
        tone: "warning",
      },
      {
        label: "Sessions actives estimées",
        value: asRows(userDetails.data).filter(
          (row) => text(row.last_seen_at) && new Date(text(row.last_seen_at)).getTime() >= Date.now() - 30 * 60000,
        ).length,
      },
    ],
    rows,
  };
}

async function aiPayload(admin: SupabaseClient): Promise<AdminFunctionalPayload> {
  const result = await admin
    .from("admin_ai_recommendations")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (result.error) throw result.error;
  const rows = asRows(result.data);
  return {
    section: "ai-center",
    title: titles["ai-center"][0],
    description: titles["ai-center"][1],
    metrics: [
      { label: "Propositions", value: rows.filter((row) => row.status === "proposed").length },
      { label: "Acceptées", value: rows.filter((row) => row.status === "accepted").length, tone: "success" },
      { label: "Reportées", value: rows.filter((row) => row.status === "postponed").length, tone: "warning" },
      { label: "Refusées", value: rows.filter((row) => row.status === "refused").length },
    ],
    rows: rows.map(tableRow),
  };
}

export async function getAdminFunctionalPayload(section: string): Promise<AdminFunctionalPayload> {
  await requireSuperAdmin();
  const admin = client();
  if (["subscriptions", "offers", "promotion-codes", "revenue", "payments"].includes(section))
    return businessPayload(section, admin);
  if (["growth", "usage", "acquisition", "retention"].includes(section)) return analyticsPayload(section, admin);
  if (["user-requests", "bugs", "ideas"].includes(section)) return supportPayload(section, admin);
  if (["practical-information", "alerts", "global-announcements", "communication-templates"].includes(section))
    return communicationPayload(section, admin);
  if (
    ["system-health", "bots", "automations", "communications", "integrations", "technical-log", "security"].includes(
      section,
    )
  )
    return systemPayload(section, admin);
  if (section === "ai-center") return aiPayload(admin);
  throw new Error("Module Super Admin inconnu.");
}

async function audit(
  admin: SupabaseClient,
  userId: string,
  action: string,
  tableName: string,
  recordId: string | null,
  values: Row,
) {
  const result = await admin
    .from("audit_logs")
    .insert({ actor_profile_id: userId, action, table_name: tableName, record_id: recordId, new_values: values });
  if (result.error) throw result.error;
}

async function dispatchCommunication(admin: SupabaseClient, communicationId: string, actorId: string) {
  const communication = await admin.from("admin_communications").select("*").eq("id", communicationId).single();
  if (communication.error) throw communication.error;
  const item = communication.data as Row;
  let membershipsQuery = admin
    .from("organization_members")
    .select("profile_id,organization_id,member_type,organizations(organization_type)")
    .eq("status", "active")
    .is("archived_at", null);
  if (item.organization_id) membershipsQuery = membershipsQuery.eq("organization_id", item.organization_id);
  if (item.owner_profile_id) membershipsQuery = membershipsQuery.eq("profile_id", item.owner_profile_id);
  if (item.property_id && !item.organization_id) {
    const property = await admin.from("biens").select("organization_id").eq("id", item.property_id).single();
    if (property.error) throw property.error;
    membershipsQuery = membershipsQuery.eq("organization_id", (property.data as Row).organization_id);
  }
  if (item.residence_id && !item.organization_id) {
    const residence = await admin.from("residences").select("organization_id").eq("id", item.residence_id).single();
    if (residence.error) throw residence.error;
    membershipsQuery = membershipsQuery.eq("organization_id", (residence.data as Row).organization_id);
  }
  const memberships = await membershipsQuery;
  if (memberships.error) throw memberships.error;
  let recipients = asRows(memberships.data);
  const audience = text(item.audience_type);
  if (audience === "all_agencies") {
    recipients = recipients.filter((row) => (row.organizations as Row | null)?.organization_type === "agency");
  } else if (audience === "all_owners") {
    recipients = recipients.filter((row) => row.member_type === "owner");
  } else if (audience === "all_tenants") {
    recipients = recipients.filter((row) => row.member_type === "tenant");
  } else if (audience === "all_contractors") {
    recipients = recipients.filter((row) => row.member_type === "contractor");
  }
  const channels = Array.isArray(item.channels) ? item.channels.map(String) : [];
  if (channels.includes("application") && recipients.length) {
    const inserted = await admin.from("communication_notifications").insert(
      recipients.map((recipient) => ({
        organization_id: recipient.organization_id,
        recipient_profile_id: recipient.profile_id,
        actor_profile_id: actorId,
        notification_type: "systeme",
        title: item.title,
        body: item.message,
        priority: item.severity === "critical" || item.severity === "urgent" ? "urgente" : "normale",
        metadata: { communication_id: communicationId, requires_acknowledgement: item.requires_acknowledgement },
      })),
    );
    if (inserted.error) throw inserted.error;
  }
  const externalChannels = channels.filter((channel) => channel !== "application");
  if (externalChannels.length) {
    const queued = await admin.from("automation_events").insert({
      organization_id: item.organization_id ?? null,
      event_type: "communication.publish",
      aggregate_type: "admin_communication",
      aggregate_id: communicationId,
      payload: { channels: externalChannels, recipient_count: recipients.length },
      idempotency_key: `communication.publish:${communicationId}`,
    });
    if (queued.error && !queued.error.message.includes("duplicate")) throw queued.error;
  }
}

export async function mutateAdminFunctional(input: AdminMutationInput) {
  const { user } = await requireSuperAdmin();
  const admin = client();
  const values = input.values ?? {};
  let result: { data: unknown; error: { message: string } | null };
  let tableName = "";
  if (input.action === "subscription_status" && input.id) {
    tableName = "organization_subscriptions";
    const authenticated = await createClient();
    result = (await authenticated.rpc(
      "transition_subscription" as never,
      {
        target_subscription_id: input.id,
        target_status: values.status,
        transition_reason: values.reason ?? "Décision Super Admin",
        transition_source: "super_admin",
      } as never,
    )) as unknown as { data: unknown; error: { message: string } | null };
  } else if (input.action === "subscription_plan" && input.id) {
    tableName = "organization_subscriptions";
    result = await admin
      .from(tableName)
      .update({ plan_id: values.plan_id, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select("*")
      .single();
  } else if (input.action === "promotion_create") {
    tableName = "promotion_codes";
    result = await admin.from(tableName).insert(values).select("*").single();
  } else if (input.action === "promotion_update" && input.id) {
    tableName = "promotion_codes";
    result = await admin.from(tableName).update(values).eq("id", input.id).select("*").single();
  } else if (input.action === "promotion_duplicate" && input.id) {
    tableName = "promotion_codes";
    const source = await admin.from(tableName).select("*").eq("id", input.id).single();
    if (source.error) throw source.error;
    const row = source.data as Row;
    result = await admin
      .from(tableName)
      .insert({
        ...row,
        id: undefined,
        code: `${text(row.code)}-COPIE-${Date.now().toString().slice(-4)}`,
        redemption_count: 0,
        created_at: undefined,
        updated_at: undefined,
      })
      .select("*")
      .single();
  } else if (input.action === "promotion_archive" && input.id) {
    tableName = "promotion_codes";
    result = await admin
      .from(tableName)
      .update({ is_active: false, archived_at: new Date().toISOString(), archived_by: user.id })
      .eq("id", input.id)
      .select("*")
      .single();
  } else if (input.action === "support_update" && input.id) {
    tableName = "admin_support_requests";
    result = await admin.from(tableName).update(values).eq("id", input.id).select("*").single();
    if (!result.error)
      await admin.from("admin_support_events").insert({
        request_id: input.id,
        actor_profile_id: user.id,
        action: text(values.status) || "updated",
        note: values.note ?? null,
      });
  } else if (input.action === "bug_decision" && input.id) {
    tableName = "quality_reports";
    let status = "rejected";
    if (values.decision === "approve") status = "approved";
    else if (values.decision === "postpone") status = "awaiting_approval";
    result = await admin.from(tableName).update({ status }).eq("id", input.id).select("*").single();
  } else if (input.action === "idea_decision" && input.id) {
    tableName = "product_ideas";
    result = await admin
      .from(tableName)
      .update({
        status: values.status,
        decision_note: values.note ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select("*")
      .single();
  } else if (input.action === "communication_create") {
    tableName = "admin_communications";
    result = await admin
      .from(tableName)
      .insert({ ...values, created_by: user.id })
      .select("*")
      .single();
  } else if (input.action === "communication_update" && input.id) {
    tableName = "admin_communications";
    result = await admin.from(tableName).update(values).eq("id", input.id).select("*").single();
    if (!result.error && values.status === "published") await dispatchCommunication(admin, input.id, user.id);
  } else if (input.action === "template_create") {
    tableName = "admin_communication_templates";
    result = await admin
      .from(tableName)
      .insert({ ...values, created_by: user.id })
      .select("*")
      .single();
  } else if (input.action === "template_update" && input.id) {
    tableName = "admin_communication_templates";
    result = await admin.from(tableName).update(values).eq("id", input.id).select("*").single();
  } else if (input.action === "workflow_retry" && input.id) {
    tableName = "automation_workflows";
    const workflow = await admin.from(tableName).select("*").eq("id", input.id).single();
    if (workflow.error) throw workflow.error;
    result = await admin
      .from("automation_events")
      .insert({
        event_type: "workflow.retry",
        aggregate_type: "automation_workflow",
        aggregate_id: input.id,
        payload: { workflow_code: (workflow.data as Row).code },
        idempotency_key: `workflow.retry:${input.id}:${Date.now()}`,
      })
      .select("*")
      .single();
  } else if (input.action === "integration_check" && input.id) {
    tableName = "system_integrations";
    result = await admin
      .from(tableName)
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", input.id)
      .select("*")
      .single();
  } else if (input.action === "ai_generate") {
    tableName = "admin_ai_recommendations";
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [events, workflows, alerts] = await Promise.all([
      admin.from("observability_events").select("source,severity,duration_ms,module").gte("occurred_at", since),
      admin.from("automation_events").select("status,last_error").gte("created_at", since),
      admin.from("monitoring_alerts").select("severity,title,source").in("status", ["open", "acknowledged"]),
    ]);
    for (const query of [events, workflows, alerts]) if (query.error) throw query.error;
    const eventRows = asRows(events.data);
    const workflowRows = asRows(workflows.data);
    const alertRows = asRows(alerts.data);
    const recommendations: Row[] = [];
    const slowApis = eventRows.filter((row) => row.source === "api" && number(row.duration_ms) > 1000);
    if (slowApis.length)
      recommendations.push({
        category: "performance",
        title: "Réduire les réponses API lentes",
        description: `${slowApis.length} réponse(s) API ont dépassé une seconde sur les sept derniers jours.`,
        expected_benefit: "Réduire le temps d’attente dans les portails.",
        impact: "Expérience utilisateur et capacité de montée en charge.",
        difficulty: "medium",
        affected_components: ["API", "services Supabase"],
        risk: "Faible si les requêtes sont optimisées sans changer les contrats.",
        estimated_minutes: 180,
        evidence: { slow_api_events: slowApis.length },
      });
    const failedWorkflows = workflowRows.filter((row) => row.status === "failed");
    if (failedWorkflows.length)
      recommendations.push({
        category: "automation",
        title: "Stabiliser les automatisations en échec",
        description: `${failedWorkflows.length} automatisation(s) sont en échec sur les sept derniers jours.`,
        expected_benefit: "Réduire les traitements manuels et les relances.",
        impact: "Fiabilité opérationnelle.",
        difficulty: "medium",
        affected_components: ["automatisations", "n8n"],
        risk: "Moyen, les reprises doivent rester idempotentes.",
        estimated_minutes: 240,
        evidence: { failed_workflows: failedWorkflows.length },
      });
    const criticalAlerts = alertRows.filter((row) => row.severity === "critical");
    if (criticalAlerts.length)
      recommendations.push({
        category: "preventive_fix",
        title: "Traiter les alertes critiques ouvertes",
        description: `${criticalAlerts.length} alerte(s) critique(s) restent ouvertes.`,
        expected_benefit: "Limiter le risque d’interruption ou de perte de service.",
        impact: "Disponibilité et sécurité.",
        difficulty: "high",
        affected_components: Array.from(new Set(criticalAlerts.map((row) => text(row.source)).filter(Boolean))),
        risk: "Élevé tant que la cause n’est pas qualifiée.",
        estimated_minutes: 300,
        evidence: { critical_alerts: criticalAlerts.length },
      });
    const existing = await admin.from(tableName).select("title").eq("status", "proposed");
    if (existing.error) throw existing.error;
    const existingTitles = new Set(asRows(existing.data).map((row) => text(row.title)));
    const newRows = recommendations.filter((recommendation) => !existingTitles.has(text(recommendation.title)));
    result = newRows.length ? await admin.from(tableName).insert(newRows).select("*") : { data: [], error: null };
  } else if (input.action === "ai_decision" && input.id) {
    tableName = "admin_ai_recommendations";
    result = await admin
      .from(tableName)
      .update({
        status: values.status,
        decision_note: values.note ?? null,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select("*")
      .single();
  } else {
    throw new Error("Action Super Admin invalide.");
  }
  if (result.error) throw new Error(result.error.message);
  await audit(admin, user.id, `ADMIN_${input.action.toUpperCase()}`, tableName, input.id ?? null, values as Row);
  return result.data;
}
