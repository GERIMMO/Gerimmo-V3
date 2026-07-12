import { createClient } from "@/lib/supabase/server";
import type { OrganizationBranding, OrganizationBrandingInput } from "@/types/organization-branding";

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

  const organization = await supabase
    .from("organizations")
    .select("id,name")
    .eq("id", targetId)
    .is("archived_at", null)
    .single();
  if (organization.error) throw organization.error;

  const agency = await supabase.rpc("is_agency_organization" as never, { target_organization_id: targetId } as never);
  return { supabase, organization: organization.data, isAgency: Boolean(agency.data) };
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
    legal_name: stringOrNull(branding.legal_name),
    address_line1: stringOrNull(branding.address_line1),
    postal_code: stringOrNull(branding.postal_code),
    city: stringOrNull(branding.city),
    primary_color: stringOrNull(branding.primary_color),
    official_signature: stringOrNull(branding.official_signature),
    updated_at: stringOrNull(branding.updated_at),
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
        legal_name: null,
        address_line1: null,
        postal_code: null,
        city: null,
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
        legal_name: clean(input.legal_name),
        address_line1: clean(input.address_line1),
        postal_code: clean(input.postal_code),
        city: clean(input.city),
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
