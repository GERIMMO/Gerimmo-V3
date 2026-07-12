export type EmailTemplateDefinition = {
  code: string;
  name: string;
  subject: string;
  title: string;
  body: string;
  variables: string[];
};

export const businessEmailTemplates: EmailTemplateDefinition[] = [
  {
    code: "welcome",
    name: "Bienvenue",
    subject: "Bienvenue sur GERIMMO",
    title: "Bienvenue {{name}}",
    body: "Votre espace GERIMMO est prêt. Votre essai de 14 jours commence aujourd’hui.",
    variables: ["name"],
  },
  {
    code: "trial_started",
    name: "Essai commencé",
    subject: "Votre essai GERIMMO a commencé",
    title: "14 jours pour découvrir GERIMMO",
    body: "Votre essai complet est actif jusqu’au {{trial_end_date}}. Aucune carte bancaire n’est requise.",
    variables: ["trial_end_date"],
  },
  {
    code: "trial_ended",
    name: "Essai terminé",
    subject: "Votre essai GERIMMO est terminé",
    title: "Vos données restent protégées",
    body: "Votre espace est suspendu. Choisissez une offre pour reprendre immédiatement, sans perte de données.",
    variables: [],
  },
  {
    code: "activation",
    name: "Activation",
    subject: "Activez votre compte GERIMMO",
    title: "Votre accès sécurisé",
    body: "Utilisez le lien sécurisé pour activer votre compte : {{activation_url}}",
    variables: ["activation_url"],
  },
  {
    code: "subscription",
    name: "Abonnement",
    subject: "Votre abonnement GERIMMO",
    title: "Abonnement confirmé",
    body: "Votre offre {{plan_name}} est maintenant active.",
    variables: ["plan_name"],
  },
  {
    code: "payment_succeeded",
    name: "Paiement réussi",
    subject: "Paiement GERIMMO confirmé",
    title: "Paiement reçu",
    body: "Votre paiement de {{amount}} a été confirmé. Merci pour votre confiance.",
    variables: ["amount"],
  },
  {
    code: "suspension",
    name: "Suspension",
    subject: "Votre espace GERIMMO est suspendu",
    title: "Accès suspendu",
    body: "Votre espace est temporairement suspendu. Vos données restent intégralement conservées.",
    variables: [],
  },
  {
    code: "reactivation",
    name: "Réactivation",
    subject: "Votre espace GERIMMO est réactivé",
    title: "Bienvenue à nouveau",
    body: "Votre abonnement et votre accès GERIMMO sont de nouveau actifs.",
    variables: [],
  },
  {
    code: "invoice",
    name: "Facture",
    subject: "Votre facture GERIMMO {{invoice_number}}",
    title: "Nouvelle facture",
    body: "Votre facture de {{amount}} est disponible dans votre espace.",
    variables: ["invoice_number", "amount"],
  },
  {
    code: "renewal",
    name: "Renouvellement",
    subject: "Renouvellement de votre abonnement GERIMMO",
    title: "Renouvellement à venir",
    body: "Votre abonnement sera renouvelé le {{renewal_date}}.",
    variables: ["renewal_date"],
  },
  {
    code: "expiration",
    name: "Expiration",
    subject: "Votre essai GERIMMO arrive à échéance",
    title: "Votre essai se termine bientôt",
    body: "Choisissez votre offre avant le {{expiration_date}} pour conserver votre accès.",
    variables: ["expiration_date"],
  },
  {
    code: "payment_failed",
    name: "Impayé",
    subject: "Action requise pour votre abonnement GERIMMO",
    title: "Paiement non abouti",
    body: "Mettez à jour votre moyen de paiement depuis votre espace sécurisé.",
    variables: [],
  },
  {
    code: "reminder",
    name: "Relance",
    subject: "Finalisez votre configuration GERIMMO",
    title: "Votre espace vous attend",
    body: "Il vous reste {{remaining_steps}} étapes pour rendre votre agence opérationnelle.",
    variables: ["remaining_steps"],
  },
  {
    code: "import_completed",
    name: "Import terminé",
    subject: "Votre import GERIMMO est terminé",
    title: "Import terminé",
    body: "{{processed_rows}} lignes ont été traitées, dont {{error_rows}} en erreur.",
    variables: ["processed_rows", "error_rows"],
  },
  {
    code: "important_incident",
    name: "Incident important",
    subject: "Incident prioritaire {{incident_number}}",
    title: "Une action est nécessaire",
    body: "L’incident {{incident_number}} nécessite votre attention.",
    variables: ["incident_number"],
  },
];

export function renderEmail(template: EmailTemplateDefinition, variables: Record<string, string>) {
  const replace = (value: string) => value.replace(/{{([a-z_]+)}}/g, (_, key: string) => variables[key] ?? "");
  const title = replace(template.title);
  const body = replace(template.body);
  return {
    subject: replace(template.subject),
    text: `${title}\n\n${body}\n\nL’équipe GERIMMO`,
    html: `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f6f8;color:#202936;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #e4e7ec;border-radius:8px"><tr><td style="padding:28px"><div style="color:#244a7c;font-weight:700">GERIMMO</div><h1 style="font-size:24px;margin:24px 0 12px">${title}</h1><p style="font-size:15px;line-height:1.6;color:#4b5565">${body}</p><p style="margin-top:28px;font-size:13px;color:#667085">L’équipe GERIMMO</p></td></tr></table></td></tr></table></body></html>`,
  };
}
