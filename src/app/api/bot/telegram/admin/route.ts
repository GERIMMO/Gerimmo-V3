import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { listTelegramAdminData, retryBotError } from "@/services/telegram-bot-service";

export async function GET() {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;

  try {
    return Response.json(await listTelegramAdminData());
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Lecture du journal Telegram impossible." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as { errorId?: string };
    if (!body.errorId) return Response.json({ message: "Erreur requise." }, { status: 400 });
    return Response.json(await retryBotError(body.errorId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Relance impossible." }, { status: 400 });
  }
}
