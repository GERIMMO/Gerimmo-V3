import { getCurrentUser } from "@/lib/auth/guards";
import { getOrganizationBranding, saveOrganizationBranding } from "@/services/organization-branding-service";
import type { OrganizationBrandingInput } from "@/types/organization-branding";

export async function GET(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  try {
    return Response.json(await getOrganizationBranding(organizationId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    return Response.json(await saveOrganizationBranding((await request.json()) as OrganizationBrandingInput));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Modification impossible." },
      { status: 403 },
    );
  }
}
