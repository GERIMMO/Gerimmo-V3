import { createPrivacyRequest } from "@/services/quality-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      requestType?: "export" | "anonymization" | "deletion" | "retention_review";
    };
    if (!body.requestType) return Response.json({ message: "Type de demande requis." }, { status: 400 });
    return Response.json(await createPrivacyRequest(body.requestType), { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Demande impossible." }, { status: 400 });
  }
}
