import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { analyzeReport, createQualityReport, decideProposal, getQualityCenter } from "@/services/quality-service";
import type { QualityPriority } from "@/types/quality";

export async function GET() {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    return Response.json(await getQualityCenter());
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (title.length < 3 || description.length < 10)
      return Response.json({ message: "Description insuffisante." }, { status: 400 });
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    return Response.json(
      await createQualityReport({
        title,
        description,
        priority: String(form.get("priority") ?? "normal") as QualityPriority,
        screenPath: String(form.get("screen_path") ?? "") || undefined,
        apiPath: String(form.get("api_path") ?? "") || undefined,
        browserInfo: JSON.parse(String(form.get("browser_info") ?? "{}")),
        deviceInfo: JSON.parse(String(form.get("device_info") ?? "{}")),
        files,
      }),
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Signalement impossible." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const body = (await request.json()) as {
      action?: "analyze" | "approve" | "reject";
      reportId?: string;
      proposalId?: string;
    };
    if (body.action === "analyze" && body.reportId) return Response.json(await analyzeReport(body.reportId));
    if ((body.action === "approve" || body.action === "reject") && body.proposalId)
      return Response.json(await decideProposal(body.proposalId, body.action));
    return Response.json({ message: "Action incomplète." }, { status: 400 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Action impossible." }, { status: 400 });
  }
}
