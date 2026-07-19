import { requireSuperAdmin } from "./administration-service";

export type ArtisanValidationStatus = "en_attente" | "valide" | "refuse";

export type ArtisanValidationRow = {
  profile_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  organization_id: string;
  organization_name: string | null;
  status: ArtisanValidationStatus;
  reviewed_at: string | null;
  review_notes: string | null;
};

type ValidationRecord = {
  profile_id: string;
  status: ArtisanValidationStatus;
  reviewed_at: string | null;
  review_notes: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

/**
 * Liste les artisans (organization_members.member_type='contractor') avec leur statut de
 * validation. Un artisan sans enregistrement est considéré « en_attente » par défaut.
 * Réservé au super admin (garde + RLS).
 */
export async function listArtisanValidations(): Promise<ArtisanValidationRow[]> {
  const { supabase } = await requireSuperAdmin();
  const [members, validations] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        "profile_id,organization_id,profiles!organization_members_profile_id_fkey(full_name,email,phone),organizations(name)",
      )
      .eq("member_type", "contractor")
      .eq("status", "active")
      .is("archived_at", null),
    supabase
      .from("artisan_validations" as never)
      .select("profile_id,status,reviewed_at,review_notes")
      .is("archived_at", null),
  ]);
  if (members.error) throw members.error;
  if (validations.error) throw validations.error;

  const byProfile = new Map<string, ValidationRecord>(
    (validations.data as unknown as ValidationRecord[]).map((record) => [record.profile_id, record]),
  );

  return (members.data ?? []).map((member) => {
    const profile = member.profiles as {
      full_name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    const organization = member.organizations as { name?: string | null } | null;
    const validation = byProfile.get(member.profile_id);
    return {
      profile_id: member.profile_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      organization_id: member.organization_id,
      organization_name: organization?.name ?? null,
      status: validation?.status ?? "en_attente",
      reviewed_at: validation?.reviewed_at ?? null,
      review_notes: validation?.review_notes ?? null,
    };
  });
}

/** Valide ou refuse un artisan (upsert par profil). Réservé au super admin. */
export async function setArtisanValidation(input: {
  profileId: string;
  status: ArtisanValidationStatus;
  notes?: string;
}) {
  const { user, supabase } = await requireSuperAdmin();
  const { data, error } = await supabase
    .from("artisan_validations" as never)
    .upsert(
      {
        profile_id: input.profileId,
        status: input.status,
        review_notes: input.notes ?? null,
        reviewed_at: nowIso(),
        reviewed_by: user.id,
        updated_at: nowIso(),
      } as never,
      { onConflict: "profile_id" },
    )
    .select("profile_id,status,reviewed_at,review_notes")
    .single();
  if (error) throw error;
  return data as unknown as ValidationRecord;
}

/**
 * Statut de validation d'un artisan par son profil (helper réutilisable par le bot).
 * Utilise le client fourni (service role côté bot). Absence d'enregistrement = « en_attente ».
 */
export async function getArtisanValidationStatus(
  supabase: { from: (table: string) => any },
  profileId: string,
): Promise<ArtisanValidationStatus> {
  const { data } = await supabase
    .from("artisan_validations")
    .select("status")
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data?.status as ArtisanValidationStatus | undefined) ?? "en_attente";
}
