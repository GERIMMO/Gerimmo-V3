import { createClient } from "@/lib/supabase/server";
import type {
  CreateScheduleRequestInput,
  IncidentScheduleEvent,
  IncidentScheduleRequest,
  IncidentScheduleResponse,
  IncidentScheduleSlot,
  IncidentScheduleSlotBatch,
  IncidentSchedulingPayload,
  ProposeScheduleSlotsInput,
  ScheduleDecisionInput,
} from "@/types/incident-scheduling";

import {
  getSupervisionIncidentIds,
  narrowToSupervisionScopeIncident,
  narrowToSupervisionScopeSchedule,
} from "./supervision-service";

const futureLinks = {
  intervention: null,
  bot: null,
  notifications: null,
};

export async function listIncidentScheduling(): Promise<IncidentSchedulingPayload> {
  const supabase = await createClient();
  const [requests, batches, slots, responses, events] = await Promise.all([
    supabase.from("incident_schedule_requests").select("*").order("updated_at", { ascending: false }),
    supabase.from("incident_schedule_slot_batches").select("*").order("round_number", { ascending: false }),
    supabase.from("incident_schedule_slots").select("*").order("starts_at", { ascending: true }),
    supabase.from("incident_schedule_responses").select("*").order("created_at", { ascending: false }),
    supabase.from("incident_schedule_events").select("*").order("created_at", { ascending: false }).limit(400),
  ]);

  for (const result of [requests, batches, slots, responses, events]) {
    if (result.error) {
      throw result.error;
    }
  }

  const incidentIds = await getSupervisionIncidentIds();
  const scopedRequests = ((requests.data ?? []) as IncidentScheduleRequest[]).filter(
    (request) => !incidentIds || incidentIds.includes(request.incident_id),
  );
  const requestIds = new Set(scopedRequests.map((request) => request.id));

  return {
    requests: scopedRequests,
    batches: ((batches.data ?? []) as IncidentScheduleSlotBatch[]).filter(
      (batch) => !incidentIds || requestIds.has(batch.schedule_request_id),
    ),
    slots: ((slots.data ?? []) as IncidentScheduleSlot[]).filter(
      (slot) => !incidentIds || requestIds.has(slot.schedule_request_id),
    ),
    responses: ((responses.data ?? []) as IncidentScheduleResponse[]).filter(
      (response) => !incidentIds || requestIds.has(response.schedule_request_id),
    ),
    events: ((events.data ?? []) as IncidentScheduleEvent[]).filter(
      (event) => !incidentIds || Boolean(event.schedule_request_id && requestIds.has(event.schedule_request_id)),
    ),
  };
}

export async function createScheduleRequest(input: CreateScheduleRequestInput) {
  await narrowToSupervisionScopeIncident(input.incident_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_schedule_requests")
    .insert({
      status: "demande_disponibilites",
      current_round: 1,
      future_links: futureLinks,
      ...input,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IncidentScheduleRequest;
}

export async function proposeScheduleSlots(input: ProposeScheduleSlotsInput) {
  if (input.slots.length < 3) {
    throw new Error("L artisan doit proposer au moins 3 creneaux.");
  }
  await narrowToSupervisionScopeSchedule(input.schedule_request_id);

  const supabase = await createClient();
  const schedule = await supabase
    .from("incident_schedule_requests")
    .select("id,organization_id,current_round")
    .eq("id", input.schedule_request_id)
    .single();

  if (schedule.error) {
    throw schedule.error;
  }

  const scheduleRequest = schedule.data as Pick<IncidentScheduleRequest, "id" | "organization_id" | "current_round">;
  const batchInsert = await supabase
    .from("incident_schedule_slot_batches")
    .insert({
      organization_id: scheduleRequest.organization_id,
      schedule_request_id: scheduleRequest.id,
      proposed_by: input.proposed_by ?? null,
      round_number: scheduleRequest.current_round,
      status: "brouillon",
      artisan_comment: input.artisan_comment ?? null,
    } as never)
    .select("*")
    .single();

  if (batchInsert.error) {
    throw batchInsert.error;
  }

  const batch = batchInsert.data as IncidentScheduleSlotBatch;
  const slotRows = input.slots.map((slot) => ({
    organization_id: scheduleRequest.organization_id,
    schedule_request_id: scheduleRequest.id,
    batch_id: batch.id,
    slot_date: slot.starts_at.slice(0, 10),
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    comment: slot.comment ?? null,
    status: "propose",
  }));

  const slotInsert = await supabase.from("incident_schedule_slots").insert(slotRows as never);
  if (slotInsert.error) {
    throw slotInsert.error;
  }

  const [batchUpdate, requestUpdate] = await Promise.all([
    supabase
      .from("incident_schedule_slot_batches")
      .update({ status: "proposee", sent_at: new Date().toISOString() } as never)
      .eq("id", batch.id)
      .select("*")
      .single(),
    // Sans .select(), un refus RLS ne lève rien : les créneaux seraient insérés mais la
    // demande resterait à son statut précédent, donc les disponibilités n'apparaîtraient
    // nulle part alors que l'artisan les a bien saisies.
    supabase
      .from("incident_schedule_requests")
      .update({ status: "creneaux_proposes" } as never)
      .eq("id", scheduleRequest.id)
      .select("id"),
  ]);

  if (batchUpdate.error) {
    throw batchUpdate.error;
  }

  if (requestUpdate.error) {
    throw requestUpdate.error;
  }
  if (!requestUpdate.data?.length) {
    throw new Error("Creneaux enregistres mais demande de planification non mise a jour.");
  }

  return batchUpdate.data as IncidentScheduleSlotBatch;
}

export async function decideSchedule(input: ScheduleDecisionInput) {
  await narrowToSupervisionScopeSchedule(input.schedule_request_id);
  const supabase = await createClient();
  const scheduleResult = await supabase
    .from("incident_schedule_requests")
    .select("*")
    .eq("id", input.schedule_request_id)
    .single();

  if (scheduleResult.error) {
    throw scheduleResult.error;
  }

  const schedule = scheduleResult.data as IncidentScheduleRequest;
  const latestBatchResult = await supabase
    .from("incident_schedule_slot_batches")
    .select("*")
    .eq("schedule_request_id", input.schedule_request_id)
    .is("archived_at", null)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestBatchResult.error) {
    throw latestBatchResult.error;
  }

  const latestBatch = latestBatchResult.data as IncidentScheduleSlotBatch | null;

  if ((input.action === "acceptation_directe" || input.action === "choix_locataire") && !input.slot_id) {
    throw new Error("Un creneau doit etre selectionne.");
  }

  const responseInsert = await supabase.from("incident_schedule_responses").insert({
    organization_id: schedule.organization_id,
    schedule_request_id: schedule.id,
    batch_id: latestBatch?.id ?? null,
    slot_id: input.slot_id ?? null,
    actor_profile_id: input.actor_profile_id ?? null,
    actor_role: input.actor_role,
    action: input.action,
    comment: input.comment ?? null,
  } as never);

  if (responseInsert.error) {
    throw responseInsert.error;
  }

  if (input.action === "transmission_locataire") {
    const [requestUpdate, batchUpdate] = await Promise.all([
      supabase
        .from("incident_schedule_requests")
        .update({ status: "transmis_locataire" } as never)
        .eq("id", schedule.id)
        .select("*")
        .single(),
      latestBatch
        ? supabase
            .from("incident_schedule_slot_batches")
            .update({ status: "transmise" } as never)
            .eq("id", latestBatch.id)
            .select("id")
        : Promise.resolve({ error: null, data: null }),
    ]);

    if (batchUpdate.error) {
      throw batchUpdate.error;
    }
    // Le gestionnaire voyait « transmis au locataire » alors que le lot de créneaux n'avait
    // pas changé d'état : les disponibilités n'étaient jamais présentées au locataire.
    if (latestBatch && !batchUpdate.data?.length) {
      throw new Error("Creneaux non transmis au locataire.");
    }

    if (requestUpdate.error) {
      throw requestUpdate.error;
    }

    return requestUpdate.data as IncidentScheduleRequest;
  }

  if (input.action === "refus_locataire") {
    const [requestUpdate, batchUpdate, slotsUpdate] = await Promise.all([
      supabase
        .from("incident_schedule_requests")
        .update({
          status: "relance_artisan",
          current_round: schedule.current_round + 1,
          selected_slot_id: null,
          validated_at: null,
        } as never)
        .eq("id", schedule.id)
        .select("*")
        .single(),
      latestBatch
        ? supabase
            .from("incident_schedule_slot_batches")
            .update({ status: "refusee" } as never)
            .eq("id", latestBatch.id)
            .select("id")
        : Promise.resolve({ error: null, data: null }),
      latestBatch
        ? supabase
            .from("incident_schedule_slots")
            .update({ status: "refuse" } as never)
            .eq("batch_id", latestBatch.id)
            .select("id")
        : Promise.resolve({ error: null, data: null }),
    ]);

    for (const result of [batchUpdate, slotsUpdate]) {
      if (result.error) {
        throw result.error;
      }
      // Des créneaux refusés qui restent marqués « proposés » réapparaissent au tour suivant
      // comme s'ils étaient toujours d'actualité.
      if (latestBatch && !result.data?.length) {
        throw new Error("Refus des creneaux non enregistre.");
      }
    }

    if (requestUpdate.error) {
      throw requestUpdate.error;
    }

    return requestUpdate.data as IncidentScheduleRequest;
  }

  if (input.action === "annulation") {
    const { data, error } = await supabase
      .from("incident_schedule_requests")
      .update({ status: "annule" } as never)
      .eq("id", schedule.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as IncidentScheduleRequest;
  }

  const selectedSlotId = input.slot_id;

  if (!selectedSlotId) {
    throw new Error("Un creneau doit etre selectionne.");
  }

  const [requestUpdate, selectedSlotUpdate, otherSlotsUpdate, batchUpdate] = await Promise.all([
    supabase
      .from("incident_schedule_requests")
      .update({ status: "valide", selected_slot_id: selectedSlotId, validated_at: new Date().toISOString() } as never)
      .eq("id", schedule.id)
      .select("*")
      .single(),
    // Le créneau retenu DOIT passer à 'selectionne' : l'écran du locataire liste les
    // rendez-vous par statut. Sans cela, la demande passait bien à 'valide' côté
    // gestionnaire mais AUCUN rendez-vous confirmé n'apparaissait au locataire —
    // l'artisan se déplaçait et le locataire n'était pas là.
    supabase
      .from("incident_schedule_slots")
      .update({ status: "selectionne" } as never)
      .eq("id", selectedSlotId)
      .select("id"),
    // Zéro ligne est ici légitime (il peut n'y avoir qu'un seul créneau) : on ne contrôle
    // que l'absence d'erreur.
    supabase
      .from("incident_schedule_slots")
      .update({ status: "refuse" } as never)
      .eq("schedule_request_id", schedule.id)
      .neq("id", selectedSlotId),
    latestBatch
      ? supabase
          .from("incident_schedule_slot_batches")
          .update({ status: "acceptee" } as never)
          .eq("id", latestBatch.id)
          .select("id")
      : Promise.resolve({ error: null, data: null }),
  ]);

  for (const result of [selectedSlotUpdate, otherSlotsUpdate, batchUpdate]) {
    if (result.error) {
      throw result.error;
    }
  }
  if (!selectedSlotUpdate.data?.length) {
    throw new Error("Rendez-vous valide mais creneau non marque comme retenu.");
  }
  if (latestBatch && !batchUpdate.data?.length) {
    throw new Error("Rendez-vous valide mais lot de creneaux non cloture.");
  }

  if (requestUpdate.error) {
    throw requestUpdate.error;
  }

  return requestUpdate.data as IncidentScheduleRequest;
}
