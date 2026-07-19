import { getCurrentUser } from "@/lib/auth/guards";
import { listExpiringDocuments, sendDocumentExpiryReminder } from "@/services/document-reminder-service";

// Rappels d'échéance des documents officiels. RLS sur documents fait autorité.
export async function GET() {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    return Response.json({ documents: await listExpiringDocuments() });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Chargement impossible." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) return Response.json({ message: "Authentification requise." }, { status: 401 });
  try {
    const body = (await request.json()) as { documentId?: string };
    if (!body.documentId) return Response.json({ message: "Document requis." }, { status: 400 });
    return Response.json(await sendDocumentExpiryReminder({ documentId: body.documentId }));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Rappel impossible." }, { status: 400 });
  }
}
