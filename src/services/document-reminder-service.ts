import { createClient } from "@/lib/supabase/server";

export type ExpiringDocumentRow = {
  id: string;
  title: string;
  reference: string;
  document_type: string;
  expires_at: string;
  expiration_alert_days: number;
  days_left: number;
  reminded_at: string | null;
  recipient_profile_id: string | null;
};

type DocumentRecord = {
  id: string;
  organization_id: string;
  title: string;
  reference: string;
  document_type: string;
  expires_at: string;
  expiration_alert_days: number;
  owner_profile_id: string | null;
  tenant_profile_id: string | null;
  metadata: Record<string, unknown> | null;
};

function nowIso() {
  return new Date().toISOString();
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Le rappel vise le locataire concerné, sinon le propriétaire (renouvellement à leur charge). */
function recipientOf(document: DocumentRecord) {
  return document.tenant_profile_id ?? document.owner_profile_id ?? null;
}

/**
 * Documents officiels datés entrant dans leur fenêtre d'alerte (ou déjà expirés), visibles
 * par l'utilisateur courant (RLS). « à renouveler » = expires_at ≤ aujourd'hui + délai d'alerte.
 */
export async function listExpiringDocuments(): Promise<ExpiringDocumentRow[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("documents")
    .select(
      "id,organization_id,title,reference,document_type,expires_at,expiration_alert_days,owner_profile_id,tenant_profile_id,metadata",
    )
    .eq("official_document", true)
    .not("expires_at", "is", null)
    .in("status", ["actif", "envoye"])
    .is("archived_at", null)
    .order("expires_at", { ascending: true })
    .limit(300);
  if (result.error) throw result.error;
  const records = (result.data ?? []) as unknown as DocumentRecord[];

  const today = new Date();
  return records
    .map((document) => {
      const expires = new Date(document.expires_at);
      const daysLeft = daysBetween(today, expires);
      return { document, daysLeft };
    })
    .filter(({ daysLeft, document }) => daysLeft <= document.expiration_alert_days)
    .map(({ document, daysLeft }) => ({
      id: document.id,
      title: document.title,
      reference: document.reference,
      document_type: document.document_type,
      expires_at: document.expires_at,
      expiration_alert_days: document.expiration_alert_days,
      days_left: daysLeft,
      reminded_at: (document.metadata?.expiry_reminded_at as string | undefined) ?? null,
      recipient_profile_id: recipientOf(document),
    }));
}

/**
 * Envoie un rappel d'échéance pour un document : e-mail au destinataire concerné (locataire
 * ou propriétaire) via la file document_email_outbox, et marque metadata.expiry_reminded_at.
 */
export async function sendDocumentExpiryReminder(input: { documentId: string }) {
  const supabase = await createClient();
  const documentResult = await supabase
    .from("documents")
    .select(
      "id,organization_id,title,reference,document_type,expires_at,owner_profile_id,tenant_profile_id,metadata,official_document",
    )
    .eq("id", input.documentId)
    .maybeSingle();
  if (documentResult.error) throw documentResult.error;
  const document = documentResult.data as unknown as (DocumentRecord & { official_document: boolean }) | null;
  if (!document || !document.official_document || !document.expires_at) {
    throw new Error("Document non éligible à un rappel d'échéance.");
  }

  const recipientProfileId = recipientOf(document);
  let emailed = false;
  if (recipientProfileId) {
    const profile = await supabase.from("profiles").select("email").eq("id", recipientProfileId).maybeSingle();
    const email = profile.data?.email as string | null | undefined;
    if (email) {
      const dueLabel = new Date(document.expires_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const outbox = await supabase.from("document_email_outbox").insert({
        organization_id: document.organization_id,
        document_id: document.id,
        recipient_email: email,
        subject: `Document à renouveler avant le ${dueLabel} - ${document.title}`,
        body: `Bonjour,\n\nLe document « ${document.title} » arrive à échéance le ${dueLabel}. Merci de procéder à son renouvellement. Il est disponible dans votre espace GERIMMO.`,
        status: "pret",
      } as never);
      if (outbox.error) throw outbox.error;
      emailed = true;
    }
  }

  const update = await supabase
    .from("documents")
    .update({ metadata: { ...(document.metadata ?? {}), expiry_reminded_at: nowIso() } } as never)
    .eq("id", document.id);
  if (update.error) throw update.error;

  return { documentId: document.id, emailed };
}
