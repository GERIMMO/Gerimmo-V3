import { getCurrentUser } from "@/lib/auth/guards";
import { revokeTelegramInvitation } from "@/services/telegram-bot-service";
import { generateWhatsAppInvitation } from "@/services/whatsapp-bot-service";

// La RLS (can_manage_users) fait autorité : la route exige seulement une session valide.
export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });

  try {
    const body = await request.json();
    return Response.json(await generateWhatsAppInvitation(body), { status: 201 });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Invitation WhatsApp impossible." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });

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
