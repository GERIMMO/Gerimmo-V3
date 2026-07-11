import type { createAdminClient } from "@/lib/supabase/admin";
import { gerimmoIdentity, roleRequiresGerimmo } from "@/services/bot/brand-rules";
import type { BotBrandIdentity } from "@/types/organization-branding";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function resolveBotBrandIdentity(
  supabase: AdminClient,
  organizationId: string,
  roleKey: string | null,
): Promise<BotBrandIdentity> {
  if (roleRequiresGerimmo(roleKey)) return gerimmoIdentity;

  const { data, error } = await supabase
    .from("organization_branding" as never)
    .select(
      "branding_enabled,display_name,logo_url,welcome_message,support_signature,support_email,support_phone,opening_hours",
    )
    .eq("organization_id", organizationId)
    .eq("branding_enabled", true)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) return gerimmoIdentity;
  const branding = data as Record<string, unknown>;
  const displayName = clean(branding.display_name) ?? gerimmoIdentity.displayName;

  return {
    customized: true,
    displayName,
    logoUrl: clean(branding.logo_url),
    welcomeMessage: clean(branding.welcome_message) ?? `Bienvenue dans l assistance de ${displayName}.`,
    supportSignature: clean(branding.support_signature) ?? `L equipe ${displayName}`,
    supportEmail: clean(branding.support_email),
    supportPhone: clean(branding.support_phone),
    openingHours: clean(branding.opening_hours),
  };
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
