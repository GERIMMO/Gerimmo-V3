import { sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { telechargerDocument } from "@/services/rent/quittance-document";

/**
 * Vidage de la file d'e-mails métier (`document_email_outbox`).
 *
 * L'application y dépose des lignes `pret` : quittances validées, relances de loyer, mises
 * en demeure, rappels d'échéance de documents. Jusqu'ici personne ne consommait cette file —
 * les e-mails étaient donc préparés mais jamais envoyés.
 *
 * Client d'administration assumé : l'envoi est déclenché par une tâche planifiée, sans
 * session utilisateur, et doit traverser toutes les organisations.
 */

export type EmailDispatchResult = {
  sent: number;
  failed: number;
  /** Détail des échecs, pour que la tâche planifiée n'échoue pas en silence. */
  failures: Array<{ id: string; message: string }>;
};

type OutboxRow = {
  id: string;
  recipient_email: string;
  subject: string;
  body: string | null;
  document_id: string | null;
};

/**
 * Pièce jointe correspondant au document lié à l'e-mail, lorsqu'un fichier existe.
 *
 * Une quittance annoncée dans le corps du message mais absente en pièce jointe oblige le
 * locataire à se connecter pour rien : on joint le fichier quand il est disponible.
 */
async function pieceJointeDuDocument(admin: ReturnType<typeof createAdminClient>, documentId: string | null) {
  if (!documentId) return undefined;
  const { data, error } = await admin
    .from("documents")
    .select("storage_path,file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.storage_path) return undefined;

  const fichier = await telechargerDocument(data.storage_path);
  return [{ filename: data.file_name ?? "document.pdf", content: fichier }];
}

export async function dispatchPendingEmails(limit = 50): Promise<EmailDispatchResult> {
  const admin = createAdminClient();
  const pending = await admin
    .from("document_email_outbox")
    .select("id,recipient_email,subject,body,document_id")
    .eq("status", "pret")
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (pending.error) throw pending.error;

  const rows = (pending.data ?? []) as unknown as OutboxRow[];
  const failures: EmailDispatchResult["failures"] = [];
  let sent = 0;

  for (const email of rows) {
    try {
      const { providerMessageId } = await sendEmail({
        to: email.recipient_email,
        subject: email.subject,
        text: email.body ?? "",
        attachments: await pieceJointeDuDocument(admin, email.document_id),
      });

      const marked = await admin
        .from("document_email_outbox")
        .update({ status: "envoye", sent_at: new Date().toISOString(), provider_message_id: providerMessageId })
        .eq("id", email.id)
        .select("id");
      if (marked.error) throw marked.error;
      // Un e-mail parti mais non marqué repartirait à chaque passage : le destinataire
      // recevrait la même quittance en boucle.
      if (!marked.data?.length) {
        throw new Error("E-mail envoye mais non marque comme tel : il serait renvoye au prochain passage.");
      }
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Envoi impossible.";
      failures.push({ id: email.id, message });
      // Passage en 'erreur' : la ligne n'est pas réessayée automatiquement (la table ne
      // compte pas les tentatives). Elle reste visible pour une reprise manuelle, ce qui
      // vaut mieux qu'une boucle d'envois vers une adresse invalide.
      await admin.from("document_email_outbox").update({ status: "erreur" }).eq("id", email.id);
    }
  }

  return { sent, failed: failures.length, failures };
}
