import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { generateTelegramInvitation, revokeTelegramInvitation } from "@/services/telegram-bot-service";

export async function POST(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json();
    return Response.json(await generateTelegramInvitation(body), { status: 201 });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Invitation Telegram impossible." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;

  try {
    const body = (await request.json()) as { invitationId?: string };
    if (!body.invitationId) return Response.json({ message: "Invitation requise." }, { status: 400 });
    return Response.json(await revokeTelegramInvitation(body.invitationId));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Revocation impossible." },
      { status: 400 },
    );
  }
}
