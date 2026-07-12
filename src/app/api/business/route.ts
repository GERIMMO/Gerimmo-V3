import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { administerSubscription, getBusinessPayload, startTrial } from "@/services/business-service";
import { simulatePayment } from "@/services/stripe-service";

export async function GET(request: Request) {
  try {
    return Response.json(
      await getBusinessPayload(new URL(request.url).searchParams.get("organizationId") ?? undefined),
    );
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { planId?: string; organizationId?: string };
    if (!body.planId) return Response.json({ message: "Offre requise." }, { status: 400 });
    return Response.json(await startTrial(body.planId, body.organizationId), { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Essai impossible." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const body = (await request.json()) as {
      subscriptionId?: string;
      action?:
        | "extend_trial"
        | "offer_month"
        | "suspend"
        | "reactivate"
        | "cancel"
        | "simulate_success"
        | "simulate_failure";
      promotionCode?: string;
    };
    if (!body.subscriptionId || !body.action) return Response.json({ message: "Action incomplète." }, { status: 400 });
    if (body.action === "simulate_success" || body.action === "simulate_failure")
      return Response.json(
        await simulatePayment(body.subscriptionId, body.action === "simulate_success" ? "succeeded" : "failed"),
      );
    return Response.json(await administerSubscription(body.subscriptionId, body.action, body.promotionCode));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Action impossible." }, { status: 400 });
  }
}
