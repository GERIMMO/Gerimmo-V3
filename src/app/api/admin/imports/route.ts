import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { executeImport, listImportJobs, previewImport } from "@/services/import-service";

export async function GET() {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    return Response.json(await listImportJobs());
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) return Response.json({ message: "Fichier requis." }, { status: 400 });
      return Response.json(await previewImport(file), { status: 201 });
    }
    const body = (await request.json()) as { jobId?: string };
    if (!body.jobId) return Response.json({ message: "Import requis." }, { status: 400 });
    return Response.json(await executeImport(body.jobId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Import impossible." }, { status: 400 });
  }
}
