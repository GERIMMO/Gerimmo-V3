import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import {
  getActiveSupervision,
  popSupervisionContext,
  pushSupervisionContext,
  recordSupervisionVisit,
  startSupervision,
  stopSupervision,
} from "@/services/supervision-service";
import type { SupervisionTargetType } from "@/types/supervision";

const targetTypes: readonly SupervisionTargetType[] = ["agency", "owner", "property", "tenant", "contractor", "user"];

function isTargetType(value: unknown): value is SupervisionTargetType {
  return typeof value === "string" && (targetTypes as readonly string[]).includes(value);
}

export async function GET() {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  return Response.json(await getActiveSupervision());
}

export async function POST(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const body = (await request.json()) as {
      action?: "start" | "push" | "pop" | "visit";
      type?: unknown;
      targetId?: unknown;
      reason?: unknown;
      route?: unknown;
    };
    if (body.action === "pop") return Response.json(await popSupervisionContext());
    if (body.action === "visit" && typeof body.route === "string") {
      await recordSupervisionVisit(body.route);
      return Response.json({ success: true });
    }
    if (!isTargetType(body.type) || typeof body.targetId !== "string") {
      return Response.json({ message: "Cible de supervision invalide." }, { status: 400 });
    }
    if (body.action === "start") {
      if (typeof body.reason !== "string") {
        return Response.json({ message: "Motif de supervision requis." }, { status: 400 });
      }
      return Response.json(await startSupervision(body.type, body.targetId, body.reason), { status: 201 });
    }
    if (body.action === "push") return Response.json(await pushSupervisionContext(body.type, body.targetId));
    return Response.json({ message: "Action de supervision inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Supervision impossible." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  await stopSupervision();
  return Response.json({ success: true });
}
