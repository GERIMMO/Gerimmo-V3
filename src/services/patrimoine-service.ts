import { createClient } from "@/lib/supabase/server";
import type {
  Bien,
  BienEcheance,
  BienHistorique,
  BienOccupant,
  CreateBienInput,
  CreatePatrimoineInput,
  CreateResidenceInput,
  Patrimoine,
  PatrimoinePayload,
  Residence,
  UpdateBienInput,
} from "@/types/patrimoine";

import {
  assertSupervisionBien,
  assertSupervisionManager,
  assertSupervisionOrganization,
  assertSupervisionPortal,
  getSupervisionDataScope,
  recordSupervisionAction,
} from "./supervision-service";

export async function listPatrimoine(): Promise<PatrimoinePayload> {
  const supabase = await createClient();
  const [patrimoines, residences, biens, occupants, echeances, historique] = await Promise.all([
    supabase.from("patrimoines").select("*").is("archived_at", null).order("name"),
    supabase.from("residences").select("*").is("archived_at", null).order("name"),
    supabase.from("biens").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("bien_occupants")
      .select("id,bien_id,full_name,occupant_type,started_at,ended_at")
      .is("archived_at", null),
    supabase
      .from("bien_echeances")
      .select("id,bien_id,title,due_date,status,amount_cents")
      .is("archived_at", null)
      .order("due_date"),
    supabase
      .from("bien_history")
      .select("id,bien_id,action,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  for (const result of [patrimoines, residences, biens, occupants, echeances, historique]) {
    if (result.error) {
      throw result.error;
    }
  }
  const supervision = await getSupervisionDataScope();
  const supervisedOrganizationId = supervision?.organizationId ?? null;
  const scopedBiens = ((biens.data ?? []) as Bien[]).filter(
    (bien) =>
      !supervisedOrganizationId ||
      (bien.organization_id === supervisedOrganizationId &&
        (!supervision?.bienIds || supervision.bienIds.includes(bien.id))),
  );
  const bienIds = new Set(scopedBiens.map((bien) => bien.id));

  return {
    patrimoines: ((patrimoines.data ?? []) as Patrimoine[]).filter(
      (item) => !supervisedOrganizationId || item.organization_id === supervisedOrganizationId,
    ),
    residences: ((residences.data ?? []) as Residence[]).filter(
      (item) => !supervisedOrganizationId || item.organization_id === supervisedOrganizationId,
    ),
    biens: scopedBiens,
    occupants: ((occupants.data ?? []) as BienOccupant[]).filter(
      (item) => !supervisedOrganizationId || bienIds.has(item.bien_id),
    ),
    echeances: ((echeances.data ?? []) as BienEcheance[]).filter(
      (item) => !supervisedOrganizationId || bienIds.has(item.bien_id),
    ),
    historique: ((historique.data ?? []) as BienHistorique[]).filter(
      (item) => !supervisedOrganizationId || (item.bien_id ? bienIds.has(item.bien_id) : false),
    ),
  };
}

export async function createPatrimoine(input: CreatePatrimoineInput) {
  await assertSupervisionManager();
  await assertSupervisionOrganization(input.organization_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patrimoines")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const patrimoine = data as Patrimoine;
  await recordSupervisionAction("PATRIMOINE_CREATED", "patrimoine", patrimoine.id);
  return patrimoine;
}

export async function createResidence(input: CreateResidenceInput) {
  await assertSupervisionManager();
  await assertSupervisionOrganization(input.organization_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("residences")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const residence = data as Residence;
  await recordSupervisionAction("RESIDENCE_CREATED", "residence", residence.id);
  return residence;
}

export async function createBien(input: CreateBienInput) {
  await assertSupervisionManager();
  await assertSupervisionOrganization(input.organization_id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("biens")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const bien = data as Bien;
  await recordSupervisionAction("PROPERTY_CREATED", "property", bien.id);
  return bien;
}

export async function updateBien({ id, ...input }: UpdateBienInput) {
  await assertSupervisionPortal(["agency", "owner", "property"]);
  await assertSupervisionBien(id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("biens")
    .update(input as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const bien = data as Bien;
  await recordSupervisionAction("PROPERTY_UPDATED", "property", bien.id);
  return bien;
}

export async function archiveBien(id: string) {
  await assertSupervisionPortal(["agency", "owner", "property"]);
  await assertSupervisionBien(id);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("biens")
    .update({ archived_at: new Date().toISOString(), status: "archive" } as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const bien = data as Bien;
  await recordSupervisionAction("PROPERTY_ARCHIVED", "property", bien.id);
  return bien;
}
