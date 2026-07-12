import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { startMirrorSession, stopMirrorSession } from "@/services/administration-service";

export async function POST(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const body = (await request.json()) as { organizationId?: string; reason?: string };
    if (!body.organizationId || !body.reason || body.reason.trim().length < 5) {
      return Response.json({ message: "Une raison de consultation est obligatoire." }, { status: 400 });
    }
    return Response.json(await startMirrorSession(body.organizationId, body.reason));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Vue miroir impossible." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  await stopMirrorSession();
  return Response.json({ success: true });
}
