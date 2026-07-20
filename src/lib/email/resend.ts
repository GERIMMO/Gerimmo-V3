/**
 * Envoi d'e-mails via Resend (API HTTP, sans SDK).
 *
 * Le domaine gerimmo.app est déjà vérifié dans Resend et sert au SMTP de Supabase Auth :
 * les e-mails métier partent donc de la même adresse que les e-mails d'authentification.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailToSend = {
  to: string;
  subject: string;
  /** Corps en texte brut : les messages métier (quittances, relances) sont rédigés ainsi. */
  text: string;
};

/**
 * Lève si la configuration manque, plutôt que de renvoyer un faux succès : une file
 * d'e-mails qui se vide sans que rien ne parte est précisément le genre de panne
 * silencieuse qu'on chasse dans ce dépôt.
 */
export async function sendEmail(input: EmailToSend): Promise<{ providerMessageId: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Envoi d e-mail non configure : RESEND_API_KEY et EMAIL_FROM sont requis.");
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
  });

  if (!response.ok) {
    throw new Error(`Resend a refuse l envoi (${response.status}) : ${(await response.text()).slice(0, 300)}`);
  }

  const payload = (await response.json().catch(() => ({}))) as { id?: string };
  return { providerMessageId: payload.id ?? null };
}
