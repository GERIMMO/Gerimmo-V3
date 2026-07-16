import { createClient } from "@/lib/supabase/server";
import type {
  ArtisanEvaluation,
  ArtisanRatingStatistic,
  CreateClosureInput,
  CreateEvaluationInput,
  CreateInterventionInput,
  CreateReportInput,
  IncidentClosureReview,
  IncidentFinalizationPayload,
  IncidentIntervention,
  InterventionEvent,
  InterventionMaterial,
  InterventionReport,
  InterventionReportEvent,
  UpdateInterventionInput,
  UpdateReportInput,
} from "@/types/incident-finalization";

import {
  assertSupervisionIncident,
  assertSupervisionIntervention,
  getSupervisionIncidentIds,
} from "./supervision-service";

const interventionFutureLinks = { rapport: null, bot: null, notifications: null };

export async function listIncidentFinalization(): Promise<IncidentFinalizationPayload> {
  const supabase = await createClient();
  const [interventions, materials, interventionEvents, reports, reportEvents, closures, evaluations, ratingStatistics] =
    await Promise.all([
      supabase.from("incident_interventions").select("*").order("updated_at", { ascending: false }),
      supabase.from("incident_intervention_materials").select("*").order("created_at", { ascending: true }),
      supabase.from("incident_intervention_events").select("*").order("created_at", { ascending: false }).limit(600),
      supabase.from("incident_intervention_reports").select("*").order("updated_at", { ascending: false }),
      supabase
        .from("incident_intervention_report_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("incident_closure_reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("incident_artisan_evaluations").select("*").order("created_at", { ascending: false }),
      supabase.from("incident_artisan_rating_statistics").select("*"),
    ]);

  for (const result of [
    interventions,
    materials,
    interventionEvents,
    reports,
    reportEvents,
    closures,
    evaluations,
    ratingStatistics,
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const incidentIds = await getSupervisionIncidentIds();
  const scopedInterventions = ((interventions.data ?? []) as IncidentIntervention[]).filter(
    (intervention) => !incidentIds || incidentIds.includes(intervention.incident_id),
  );
  const interventionIds = new Set(scopedInterventions.map((intervention) => intervention.id));

  return {
    interventions: scopedInterventions,
    materials: ((materials.data ?? []) as InterventionMaterial[]).filter(
      (material) => !incidentIds || interventionIds.has(material.intervention_id),
    ),
    interventionEvents: ((interventionEvents.data ?? []) as InterventionEvent[]).filter(
      (event) => !incidentIds || Boolean(event.intervention_id && interventionIds.has(event.intervention_id)),
    ),
    reports: ((reports.data ?? []) as InterventionReport[]).filter(
      (report) => !incidentIds || interventionIds.has(report.intervention_id),
    ),
    reportEvents: ((reportEvents.data ?? []) as InterventionReportEvent[]).filter(
      (event) => !incidentIds || Boolean(event.intervention_id && interventionIds.has(event.intervention_id)),
    ),
    closures: ((closures.data ?? []) as IncidentClosureReview[]).filter(
      (closure) => !incidentIds || incidentIds.includes(closure.incident_id),
    ),
    evaluations: ((evaluations.data ?? []) as ArtisanEvaluation[]).filter(
      (evaluation) => !incidentIds || interventionIds.has(evaluation.intervention_id),
    ),
    ratingStatistics: (ratingStatistics.data ?? []) as ArtisanRatingStatistic[],
  };
}

export async function createIntervention(input: CreateInterventionInput) {
  await assertSupervisionIncident(input.incident_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_interventions")
    .insert({
      status: "planifiee",
      photos_before: [],
      photos_during: [],
      photos_after: [],
      planned_amount_cents: 0,
      future_links: interventionFutureLinks,
      ...input,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IncidentIntervention;
}

export async function updateIntervention({ id, ...input }: UpdateInterventionInput) {
  await assertSupervisionIntervention(id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_interventions")
    .update(input as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IncidentIntervention;
}

export async function startIntervention(id: string) {
  return updateIntervention({ id, status: "en_cours", actual_starts_at: new Date().toISOString() });
}

export async function suspendIntervention(id: string, responsibleComment?: string | null) {
  return updateIntervention({ id, status: "suspendue", responsible_comment: responsibleComment ?? null });
}

export async function resumeIntervention(id: string) {
  return updateIntervention({ id, status: "en_cours" });
}

export async function cancelIntervention(id: string, responsibleComment?: string | null) {
  return updateIntervention({ id, status: "annulee", responsible_comment: responsibleComment ?? null });
}

export async function reprogramIntervention(id: string, responsibleComment?: string | null) {
  return updateIntervention({ id, status: "a_reprogrammer", responsible_comment: responsibleComment ?? null });
}

export async function completeIntervention(input: UpdateInterventionInput) {
  return updateIntervention({
    ...input,
    status: "terminee",
    actual_ends_at: input.actual_ends_at ?? new Date().toISOString(),
  });
}

export async function addInterventionMaterial(input: Omit<InterventionMaterial, "id" | "created_at" | "archived_at">) {
  await assertSupervisionIntervention(input.intervention_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_intervention_materials")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as InterventionMaterial;
}

export async function createInterventionReport(input: CreateReportInput) {
  await assertSupervisionIntervention(input.intervention_id);
  const supabase = await createClient();
  const interventionResult = await supabase
    .from("incident_interventions")
    .select("*")
    .eq("id", input.intervention_id)
    .single();

  if (interventionResult.error) {
    throw interventionResult.error;
  }

  const intervention = interventionResult.data as IncidentIntervention;
  const reportReference = `RAP-${new Date().getFullYear()}-${intervention.id.slice(0, 8).toUpperCase()}`;
  const fileName = `${reportReference}.pdf`;
  const storagePath = `rapports-incidents/${intervention.organization_id}/${fileName}`;
  const reportData = buildReportData(intervention, reportReference, input.observations ?? null);

  const documentResult = await supabase
    .from("documents")
    .insert({
      organization_id: intervention.organization_id,
      bien_id: intervention.bien_id,
      tenant_profile_id: intervention.tenant_profile_id,
      title: `Rapport d intervention ${reportReference}`,
      reference: reportReference,
      description: "Rapport officiel GERIMMO rattache a l intervention.",
      document_type: "rapport_incident",
      status: "actif",
      visibility: "organisation",
      storage_path: storagePath,
      file_name: fileName,
      mime_type: "application/pdf",
      file_size_bytes: estimatePdfSize(reportData),
      official_document: true,
      metadata: {
        incident_id: intervention.incident_id,
        intervention_id: intervention.id,
        pdf_ready: true,
        sections: ["contexte", "travaux", "photos", "montants", "chronologie", "validations"],
      },
      mail_context: { prepared: false },
      bot_context: { future_ready: true },
      created_by: input.created_by ?? null,
    } as never)
    .select("*")
    .single();

  if (documentResult.error) {
    throw documentResult.error;
  }

  const document = documentResult.data as { id: string };
  const reportResult = await supabase
    .from("incident_intervention_reports")
    .insert({
      organization_id: intervention.organization_id,
      incident_id: intervention.incident_id,
      intervention_id: intervention.id,
      document_id: document.id,
      report_reference: reportReference,
      status: "genere",
      report_data: reportData,
      observations: input.observations ?? null,
      generated_at: new Date().toISOString(),
      pdf_storage_path: storagePath,
      pdf_file_name: fileName,
      metadata: { document_id: document.id, pdf_layout: "gerimmo_officiel" },
      created_by: input.created_by ?? null,
    } as never)
    .select("*")
    .single();

  if (reportResult.error) {
    throw reportResult.error;
  }

  const report = reportResult.data as InterventionReport;
  await supabase
    .from("incident_interventions")
    .update({ future_links: { rapport: report.id, bot: null, notifications: null } } as never)
    .eq("id", intervention.id);

  return report;
}

export async function updateInterventionReport({ id, action, ...input }: UpdateReportInput) {
  const supabase = await createClient();
  const currentReport = await supabase
    .from("incident_intervention_reports")
    .select("intervention_id")
    .eq("id", id)
    .single();
  if (currentReport.error) throw currentReport.error;
  await assertSupervisionIntervention((currentReport.data as { intervention_id: string }).intervention_id);
  const patch: Record<string, unknown> = { ...input };

  if (action === "preview") {
    patch.status = "previsualise";
  }
  if (action === "edit") {
    patch.status = "modifie";
  }
  if (action === "generate") {
    patch.status = "genere";
    patch.generated_at = new Date().toISOString();
  }
  if (action === "validate") {
    patch.status = "valide";
    patch.validated_at = new Date().toISOString();
  }
  if (action === "download") {
    patch.downloaded_at = new Date().toISOString();
  }
  if (action === "print") {
    patch.printed_at = new Date().toISOString();
  }
  if (action === "prepare_email") {
    patch.email_prepared_at = new Date().toISOString();
  }
  if (action === "archive") {
    patch.status = "archive";
    patch.archived_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("incident_intervention_reports")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as InterventionReport;
}

export async function createIncidentClosure(input: CreateClosureInput) {
  await assertSupervisionIncident(input.incident_id);
  await assertSupervisionIntervention(input.intervention_id);
  const supabase = await createClient();
  const statusMap = {
    validation: "valide",
    correction: "correction_demandee",
    nouvelle_intervention: "nouvelle_intervention",
    cloture_reserve: "cloture_reserve",
    cloture_normale: "cloture_normale",
  } as const;
  const { data, error } = await supabase
    .from("incident_closure_reviews")
    .insert({
      status: statusMap[input.action],
      new_intervention_required: input.action === "nouvelle_intervention",
      ...input,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IncidentClosureReview;
}

export async function createArtisanEvaluation(input: CreateEvaluationInput) {
  await assertSupervisionIncident(input.incident_id);
  await assertSupervisionIntervention(input.intervention_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_artisan_evaluations")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ArtisanEvaluation;
}

function buildReportData(intervention: IncidentIntervention, reference: string, observations: string | null) {
  return {
    reference,
    organisation: intervention.organization_id,
    incident: intervention.incident_id,
    bien: intervention.bien_id,
    locataire: intervention.tenant_profile_id,
    intervenant: intervention.artisan_profile_id ?? intervention.internal_intervenant_profile_id,
    devis_retenu: intervention.accepted_quote_id,
    horaires: {
      planifies: { debut: intervention.planned_starts_at, fin: intervention.planned_ends_at },
      reels: { debut: intervention.actual_starts_at, fin: intervention.actual_ends_at },
    },
    probleme_initial: intervention.metadata.initial_problem ?? null,
    travaux_effectues: intervention.work_description,
    pieces_materiaux: [],
    photos: { avant: intervention.photos_before, apres: intervention.photos_after },
    montants: {
      prevu: intervention.planned_amount_cents,
      final: intervention.final_amount_cents,
      ecart: intervention.amount_difference_cents,
      justification: intervention.difference_reason,
    },
    observations,
    validations: intervention.completion_validation,
    chronologie: ["incident", "devis", "planification", "intervention", "rapport"],
    pdf: {
      titre: "Rapport officiel GERIMMO",
      pagination: true,
      pied_de_page: "GERIMMO V3 - Rapport d intervention",
    },
  };
}

function estimatePdfSize(reportData: Record<string, unknown>) {
  return Math.max(JSON.stringify(reportData).length * 2, 12000);
}
