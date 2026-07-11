import {
  createCommunicationConversation,
  createCommunicationNotification,
  getCommunicationPayload,
  markNotificationRead,
  saveCommunicationPreferences,
  sendCommunicationMessage,
} from "@/services/communication-service";
import type { CommunicationPreferences, CreateConversationInput, NotificationType } from "@/types/communication";

export async function GET() {
  try {
    return Response.json(await getCommunicationPayload());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const conversationId = String(form.get("conversation_id") ?? "");
      const body = String(form.get("body") ?? "");
      const files = form.getAll("files").filter((item): item is File => item instanceof File);
      return Response.json(await sendCommunicationMessage({ conversation_id: conversationId, body }, files), {
        status: 201,
      });
    }

    const body = (await request.json()) as Record<string, unknown>;
    switch (body.action) {
      case "create_conversation":
        return Response.json(await createCommunicationConversation(body.payload as CreateConversationInput), {
          status: 201,
        });
      case "create_notification":
        return Response.json(
          await createCommunicationNotification(
            body.payload as {
              recipient_profile_id: string;
              notification_type: NotificationType;
              title: string;
              body: string;
              priority?: string;
              action_url?: string | null;
            },
          ),
          { status: 201 },
        );
      case "mark_notification": {
        const payload = body.payload as { notification_id: string; read: boolean };
        return Response.json(await markNotificationRead(payload.notification_id, payload.read));
      }
      case "save_preferences":
        return Response.json(await saveCommunicationPreferences(body.payload as Omit<CommunicationPreferences, "id">));
      default:
        return Response.json({ message: "Action inconnue." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Operation impossible.";
  return Response.json({ message }, { status: message === "Authentification requise." ? 401 : 400 });
}
