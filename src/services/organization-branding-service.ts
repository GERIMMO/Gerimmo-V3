import { createClient } from "@/lib/supabase/server";
import type {
  OrganizationBranding,
  OrganizationBrandingInput,
  OrganizationLegalIdentity,
  OrganizationLegalIdentityInput,
} from "@/types/organization-branding";

const CHAMPS_IDENTITE = "legal_name,siren,address_line1,address_line2,postal_code,city,contact_email,contact_phone";

async function resolveOrganization(organizationId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentification requise.");

  let targetId = organizationId;
  if (!targetId) {
    const membership = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    targetId = membership.data?.organization_id;
  }
  if (!targetId) throw new Error("Aucune organisation active.");

  // L'identité légale (raison sociale, SIREN, adresse) est lue en même temps : elle vit sur
  // organizations et alimente directement les documents officiels.
  const organization = await supabase
    .from("organizations")
    .select(`id,name,${CHAMPS_IDENTITE}`)
    .eq("id", targetId)
    .is("archived_at", null)
    .single();
  if (organization.error) throw organization.error;

  const agency = await supabase.rpc("is_agency_organization" as never, { target_organization_id: targetId } as never);
  return { supabase, organization: organization.data, isAgency: Boolean(agency.data) };
}

type OrganizationIdentiteRow = {
  id: string;
  name: string;
  legal_name: string | null;
  siren: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

function identiteDepuis(organization: OrganizationIdentiteRow): OrganizationLegalIdentity {
  return {
    legal_name: stringOrNull(organization.legal_name),
    siren: stringOrNull(organization.siren),
    address_line1: stringOrNull(organization.address_line1),
    address_line2: stringOrNull(organization.address_line2),
    postal_code: stringOrNull(organization.postal_code),
    city: stringOrNull(organization.city),
    contact_email: stringOrNull(organization.contact_email),
    contact_phone: stringOrNull(organization.contact_phone),
  };
}

/**
 * Enregistre l'identité légale de l'organisation (raison sociale, SIREN, adresse, contacts).
 *
 * Passe par la session de l'utilisateur : la RLS (`can_manage_organization`) autorise le
 * super admin, l'administrateur d'agence et le propriétaire titulaire de l'organisation.
 * Un UPDATE bloqué par la RLS ne lève rien — on vérifie donc qu'une ligne a bien été touchée.
 */
export async function saveOrganizationLegalIdentity(input: OrganizationLegalIdentityInput) {
  const supabase = await createClient();
  const applied = await supabase
    .from("organizations")
    .update({
      legal_name: clean(input.legal_name),
      siren: clean(input.siren),
      address_line1: clean(input.address_line1),
      address_line2: clean(input.address_line2),
      postal_code: clean(input.postal_code),
      city: clean(input.city),
      contact_email: clean(input.contact_email),
      contact_phone: clean(input.contact_phone),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.organization_id)
    .is("archived_at", null)
    .select("id");
  if (applied.error) throw applied.error;
  if (!applied.data?.length) {
    throw new Error("Identité non enregistrée : vous ne gérez pas cette organisation.");
  }
  return getOrganizationBranding(input.organization_id);
}

export async function getOrganizationBranding(organizationId?: string): Promise<OrganizationBranding> {
  const { supabase, organization, isAgency } = await resolveOrganization(organizationId);
  const result = await supabase
    .from("organization_branding" as never)
    .select("*")
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .maybeSingle();
  if (result.error) throw result.error;
  const branding = (result.data ?? {}) as Record<string, unknown>;

  return {
    id: stringOrNull(branding.id),
    organization_id: organization.id,
    organization_name: organization.name,
    is_agency: isAgency,
    branding_enabled: Boolean(branding.branding_enabled),
    display_name: stringOrNull(branding.display_name),
    logo_url: stringOrNull(branding.logo_url),
    welcome_message: stringOrNull(branding.welcome_message),
    support_signature: stringOrNull(branding.support_signature),
    support_email: stringOrNull(branding.support_email),
    support_phone: stringOrNull(branding.support_phone),
    opening_hours: stringOrNull(branding.opening_hours),
    primary_color: stringOrNull(branding.primary_color),
    official_signature: stringOrNull(branding.official_signature),
    updated_at: stringOrNull(branding.updated_at),
    legal: identiteDepuis(organization),
  };
}

export async function listBrandingOrganizations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentification requise.");
  const result = await supabase
    .from("organizations")
    .select("id,name")
    .eq("status", "active")
    .is("archived_at", null)
    .order("name");
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function saveOrganizationBranding(input: OrganizationBrandingInput) {
  const { supabase, organization, isAgency } = await resolveOrganization(input.organization_id);
  if (input.branding_enabled && !isAgency) {
    throw new Error("La personnalisation est reservee aux agences immobilieres.");
  }

  const restored = input.restore === true;
  const values = restored
    ? {
        organization_id: organization.id,
        branding_enabled: false,
        display_name: null,
        logo_url: null,
        welcome_message: null,
        support_signature: null,
        support_email: null,
        support_phone: null,
        opening_hours: null,
        primary_color: null,
        official_signature: null,
      }
    : {
        organization_id: organization.id,
        branding_enabled: input.branding_enabled,
        display_name: clean(input.display_name),
        logo_url: clean(input.logo_url),
        welcome_message: clean(input.welcome_message),
        support_signature: clean(input.support_signature),
        support_email: clean(input.support_email),
        support_phone: clean(input.support_phone),
        opening_hours: clean(input.opening_hours),
        primary_color: clean(input.primary_color),
        official_signature: clean(input.official_signature),
      };

  const result = await supabase
    .from("organization_branding" as never)
    .upsert(values as never, { onConflict: "organization_id" })
    .select("id")
    .single();
  if (result.error) throw result.error;
  return getOrganizationBranding(organization.id);
}

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}
