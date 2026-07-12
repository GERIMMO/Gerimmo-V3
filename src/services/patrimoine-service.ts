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

import { getMirrorOrganizationId } from "./administration-service";

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
  const mirrorOrganizationId = await getMirrorOrganizationId();
  const scopedBiens = ((biens.data ?? []) as Bien[]).filter(
    (bien) => !mirrorOrganizationId || bien.organization_id === mirrorOrganizationId,
  );
  const bienIds = new Set(scopedBiens.map((bien) => bien.id));

  return {
    patrimoines: ((patrimoines.data ?? []) as Patrimoine[]).filter(
      (item) => !mirrorOrganizationId || item.organization_id === mirrorOrganizationId,
    ),
    residences: ((residences.data ?? []) as Residence[]).filter(
      (item) => !mirrorOrganizationId || item.organization_id === mirrorOrganizationId,
    ),
    biens: scopedBiens,
    occupants: ((occupants.data ?? []) as BienOccupant[]).filter(
      (item) => !mirrorOrganizationId || bienIds.has(item.bien_id),
    ),
    echeances: ((echeances.data ?? []) as BienEcheance[]).filter(
      (item) => !mirrorOrganizationId || bienIds.has(item.bien_id),
    ),
    historique: ((historique.data ?? []) as BienHistorique[]).filter(
      (item) => !mirrorOrganizationId || (item.bien_id ? bienIds.has(item.bien_id) : false),
    ),
  };
}

export async function createPatrimoine(input: CreatePatrimoineInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patrimoines")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Patrimoine;
}

export async function createResidence(input: CreateResidenceInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("residences")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Residence;
}

export async function createBien(input: CreateBienInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("biens")
    .insert(input as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Bien;
}

export async function updateBien({ id, ...input }: UpdateBienInput) {
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

  return data as Bien;
}

export async function archiveBien(id: string) {
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

  return data as Bien;
}
