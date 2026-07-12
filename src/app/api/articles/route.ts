import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { listArticles, saveArticle } from "@/services/administration-service";

export async function GET() {
  try {
    return Response.json(await listArticles());
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Lecture impossible." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    return Response.json(await saveArticle(await request.json()), { status: 201 });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Publication impossible." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    return Response.json(await saveArticle(await request.json()));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Modification impossible." },
      { status: 400 },
    );
  }
}
