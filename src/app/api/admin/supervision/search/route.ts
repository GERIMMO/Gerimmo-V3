import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { searchSupervisionTargets } from "@/services/supervision-service";

export async function GET(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const organizationId = url.searchParams.get("organizationId");
  try {
    return Response.json(await searchSupervisionTargets(query, organizationId));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Recherche impossible." },
      { status: 400 },
    );
  }
}
