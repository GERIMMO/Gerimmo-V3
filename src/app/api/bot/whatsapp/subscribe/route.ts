import { getCurrentUser } from "@/lib/auth/guards";
import { subscribeWhatsAppAccount } from "@/services/whatsapp-bot-service";

// Abonne le compte WhatsApp Business à l'app (nécessaire pour recevoir les messages entrants).
// Utilise le jeton serveur ; exige seulement une session valide (page réglages déjà protégée).
export async function POST() {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    return Response.json(await subscribeWhatsAppAccount());
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Abonnement WhatsApp impossible." },
      { status: 400 },
    );
  }
}
