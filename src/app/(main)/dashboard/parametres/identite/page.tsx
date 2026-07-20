import { requireUser } from "@/lib/auth/guards";
import { getOrganizationBranding, listBrandingOrganizations } from "@/services/organization-branding-service";

import { AgencyBrandingSettings } from "./_components/agency-branding-settings";

export default async function Page({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  await requireUser("/auth/v1/login");
  const { organizationId } = await searchParams;
  const organizations = await listBrandingOrganizations();
  const selectedId = organizationId ?? organizations[0]?.id;
  const branding = await getOrganizationBranding(selectedId);

  return <AgencyBrandingSettings initialBranding={branding} organizations={organizations} />;
}
