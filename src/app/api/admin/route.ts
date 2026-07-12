import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { getAdminDashboard, updateOrganizationStatus } from "@/services/administration-service";

export async function GET() {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    return Response.json(await getAdminDashboard());
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const body = (await request.json()) as { organizationId?: string; action?: "disable" | "reactivate" | "archive" };
    if (!body.organizationId || !body.action) return Response.json({ message: "Action incomplète." }, { status: 400 });
    return Response.json(await updateOrganizationStatus(body.organizationId, body.action));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Action impossible." }, { status: 400 });
  }
}
