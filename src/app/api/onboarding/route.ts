import { createOrganization, getOnboarding, updateOnboardingStep } from "@/services/business-service";

export async function GET() {
  try {
    return Response.json(await getOnboarding());
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { stepId?: string; status?: "in_progress" | "completed" | "skipped" };
    if (!body.stepId || !body.status) return Response.json({ message: "Étape incomplète." }, { status: 400 });
    return Response.json(await updateOnboardingStep(body.stepId, body.status));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Mise à jour impossible." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      planId?: string;
      organizationType?: "agency" | "independent_owner";
    };
    if (!body.name || !body.slug || !body.planId || !body.organizationType)
      return Response.json({ message: "Informations incomplètes." }, { status: 400 });
    return Response.json(
      await createOrganization({
        name: body.name,
        slug: body.slug,
        planId: body.planId,
        organizationType: body.organizationType,
      }),
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Création impossible." }, { status: 400 });
  }
}
