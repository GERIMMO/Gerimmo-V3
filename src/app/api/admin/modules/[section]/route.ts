import { z } from "zod";

import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { getAdminFunctionalPayload, mutateAdminFunctional } from "@/services/admin-functional-service";
import type { AdminMutationInput } from "@/types/admin-functional";

const mutationSchema = z.object({
  action: z.enum([
    "subscription_status",
    "subscription_plan",
    "promotion_create",
    "promotion_update",
    "promotion_duplicate",
    "promotion_archive",
    "support_update",
    "bug_decision",
    "idea_decision",
    "communication_create",
    "communication_update",
    "template_create",
    "template_update",
    "workflow_retry",
    "integration_check",
    "ai_generate",
    "ai_decision",
  ]),
  id: z.uuid().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});

type ModuleContext = { params: Promise<{ section: string }> };

export async function GET(_request: Request, context: ModuleContext) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const { section } = await context.params;
    return Response.json(await getAdminFunctionalPayload(section));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 400 });
  }
}

export async function POST(request: Request, _context: ModuleContext) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const input = mutationSchema.parse(await request.json()) as AdminMutationInput;
    return Response.json(await mutateAdminFunctional(input), { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Création impossible." }, { status: 400 });
  }
}

export async function PATCH(request: Request, _context: ModuleContext) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const input = mutationSchema.parse(await request.json()) as AdminMutationInput;
    return Response.json(await mutateAdminFunctional(input));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Action impossible." }, { status: 400 });
  }
}
