import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QualityCenterPayload, QualityPriority, QualityReport } from "@/types/quality";

import { requireSuperAdmin } from "./administration-service";
import { analyzeQualityReport, sensitiveAreas } from "./quality-rules";
import { randomUUID } from "node:crypto";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"]);

async function qualityContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");
  const membership = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  return { supabase, user: auth.user, organizationId: membership.data?.organization_id ?? null };
}

export async function createQualityReport(input: {
  title: string;
  description: string;
  priority: QualityPriority;
  screenPath?: string;
  apiPath?: string;
  browserInfo?: Record<string, unknown>;
  deviceInfo?: Record<string, unknown>;
  files?: File[];
}) {
  const { supabase, user, organizationId } = await qualityContext();
  const report = await supabase
    .from("quality_reports" as never)
    .insert({
      organization_id: organizationId,
      reporter_profile_id: user.id,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      screen_path: input.screenPath ?? null,
      api_path: input.apiPath ?? null,
      browser_info: input.browserInfo ?? {},
      device_info: input.deviceInfo ?? {},
    } as never)
    .select("*")
    .single();
  if (report.error) throw report.error;
  const created = report.data as QualityReport;
  for (const file of input.files ?? []) {
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > 52_428_800)
      throw new Error("Capture invalide ou supérieure à 50 Mo.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${user.id}/${created.id}/${randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage
      .from("quality-attachments")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const attachment = await supabase.from("quality_attachments" as never).insert({
      report_id: created.id,
      organization_id: organizationId,
      uploaded_by: user.id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    } as never);
    if (attachment.error) throw attachment.error;
  }
  await supabase.from("observability_events" as never).insert({
    organization_id: organizationId,
    profile_id: user.id,
    quality_report_id: created.id,
    correlation_id: created.correlation_id,
    source: "browser",
    event_type: "quality.reported",
    severity: input.priority === "critical" ? "critical" : "info",
    screen_path: input.screenPath ?? null,
    api_path: input.apiPath ?? null,
    message: input.title,
    metadata: { browser: input.browserInfo ?? {}, device: input.deviceInfo ?? {} },
  } as never);
  return created;
}

export async function getQualityCenter(): Promise<QualityCenterPayload> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const [reports, analyses, proposals, alerts, privacy, backups, events] = await Promise.all([
    admin
      .from("quality_reports")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("quality_analyses").select("*").order("generated_at", { ascending: false }).limit(100),
    admin.from("correction_proposals").select("*").order("created_at", { ascending: false }).limit(100),
    admin
      .from("monitoring_alerts")
      .select("*")
      .neq("status", "resolved")
      .order("last_seen_at", { ascending: false })
      .limit(100),
    admin.from("privacy_requests").select("*").order("created_at", { ascending: false }).limit(100),
    admin.from("backup_registry").select("*").order("created_at", { ascending: false }).limit(30),
    admin
      .from("observability_events")
      .select("source,severity,duration_ms,occurred_at")
      .gte("occurred_at", new Date(Date.now() - 86400000).toISOString())
      .limit(5000),
  ]);
  for (const result of [reports, analyses, proposals, alerts, privacy, backups, events])
    if (result.error) throw result.error;
  const sources = ["browser", "api", "supabase", "n8n", "telegram", "storage", "build", "system"];
  const sourceHealth = sources.map((source) => {
    const rows = (events.data ?? []).filter((event) => event.source === source);
    const durations = rows
      .map((event) => event.duration_ms)
      .filter((value): value is number => typeof value === "number");
    return {
      source,
      errors: rows.filter((event) => ["error", "critical"].includes(event.severity)).length,
      warnings: rows.filter((event) => event.severity === "warning").length,
      averageDurationMs: durations.length
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : 0,
    };
  });
  return {
    reports: (reports.data ?? []) as QualityCenterPayload["reports"],
    analyses: (analyses.data ?? []) as QualityCenterPayload["analyses"],
    proposals: (proposals.data ?? []) as QualityCenterPayload["proposals"],
    alerts: alerts.data ?? [],
    privacyRequests: privacy.data ?? [],
    backups: backups.data ?? [],
    metrics: [
      {
        label: "Signalements ouverts",
        value: (reports.data ?? []).filter((row) => !["resolved", "archived"].includes(row.status)).length,
        tone: "warning",
      },
      {
        label: "Alertes critiques",
        value: (alerts.data ?? []).filter((row) => row.severity === "critical").length,
        tone: "danger",
      },
      {
        label: "Demandes RGPD",
        value: (privacy.data ?? []).filter((row) => row.status !== "completed").length,
        tone: "neutral",
      },
      {
        label: "Sauvegardes réussies",
        value: (backups.data ?? []).filter((row) => row.status === "completed").length,
        tone: "success",
      },
    ],
    sourceHealth,
  };
}

export async function analyzeReport(reportId: string) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();
  const reportResult = await admin.from("quality_reports").select("*").eq("id", reportId).single();
  if (reportResult.error) throw reportResult.error;
  const report = reportResult.data as QualityReport;
  const events = await admin
    .from("observability_events")
    .select("*")
    .eq("correlation_id", report.correlation_id)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (events.error) throw events.error;
  const analysis = analyzeQualityReport(report, events.data ?? []);
  const stored = await admin
    .from("quality_analyses")
    .upsert(analysis, { onConflict: "report_id" })
    .select("*")
    .single();
  if (stored.error) throw stored.error;
  const areas = sensitiveAreas(analysis.affected_files, [], analysis.affected_workflows);
  const proposal = await admin
    .from("correction_proposals")
    .upsert(
      {
        report_id: report.id,
        problem: report.description,
        cause: analysis.probable_cause,
        why: "La correction doit supprimer la cause sans modifier les règles métier validées.",
        modified_files: analysis.affected_files,
        impacted_tables: [],
        impacted_workflows: analysis.affected_workflows,
        impacted_users: `${analysis.impacted_users_estimate} utilisateur(s) estimé(s)`,
        risks: areas.length
          ? `Zones sensibles : ${areas.join(", ")}. Validation humaine obligatoire.`
          : "Risque limité sous réserve des tests.",
        changes: "Correction minimale à définir après reproduction.",
        unchanged: "Règles métier, données client et contrats API non concernés resteront inchangés.",
        positive_outcomes: "Réduction des erreurs et amélioration de la traçabilité.",
        estimated_minutes: 60,
        planned_tests: ["TypeScript", "ESLint", "tests ciblés", "build", "validation Vercel"],
        rollback_plan: "Revenir au commit Git précédent et restaurer la sauvegarde si une donnée est affectée.",
        git_backup_plan: "Créer un commit de sauvegarde avant toute application.",
        requires_human_approval: true,
        sensitive_areas: areas,
        status: "awaiting_approval",
      },
      { onConflict: "report_id" },
    )
    .select("*")
    .single();
  if (proposal.error) throw proposal.error;
  await admin.from("quality_reports").update({ status: "awaiting_approval" }).eq("id", report.id);
  await admin.from("audit_logs").insert({
    organization_id: report.organization_id,
    actor_profile_id: user.id,
    action: "QUALITY_ANALYSIS_GENERATED",
    table_name: "quality_reports",
    record_id: report.id,
    new_values: { severity: analysis.severity, proposal_id: proposal.data.id },
  });
  return { analysis: stored.data, proposal: proposal.data };
}

export async function decideProposal(proposalId: string, decision: "approve" | "reject") {
  const { user } = await requireSuperAdmin();
  const values =
    decision === "approve"
      ? { status: "approved", approved_by: user.id, approved_at: new Date().toISOString() }
      : { status: "rejected", rejected_by: user.id, rejected_at: new Date().toISOString() };
  const result = await createAdminClient()
    .from("correction_proposals")
    .update(values)
    .eq("id", proposalId)
    .select("*")
    .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function createPrivacyRequest(requestType: "export" | "anonymization" | "deletion" | "retention_review") {
  const { supabase, user, organizationId } = await qualityContext();
  const created = await supabase
    .from("privacy_requests" as never)
    .insert({
      organization_id: organizationId,
      subject_profile_id: user.id,
      requested_by: user.id,
      request_type: requestType,
    } as never)
    .select("*")
    .single();
  if (created.error) throw created.error;
  await supabase.from("privacy_audit_logs" as never).insert({
    privacy_request_id: (created.data as { id: string }).id,
    actor_profile_id: user.id,
    action: "REQUEST_CREATED",
  } as never);
  return created.data;
}
