/**
 * Menus du bot par rôle, partagés par WhatsApp et Telegram.
 *
 * Logique volontairement PURE (aucun accès base, aucun client Supabase) et placée dans
 * services/bot/ avec les autres règles pures : c'est ce qui la rend testable — importer
 * telegram-bot-service dans un test entraîne toute la chaîne Supabase.
 */

export type BotMenuButton = { text: string; callbackData: string };
export type BotMenu = { text: string; buttons: BotMenuButton[][] };

/**
 * ⚠️ Les rôles de back-office (agent_immobilier, administrateur_agence, super_admin) ne
 * sont pas traités et retombent sur le menu locataire. Voir tests/bot-menus.test.ts, qui
 * documente ce trou.
 */
export function roleMenu(role: string): BotMenu {
  if (role === "artisan") {
    return {
      text: "Que souhaitez-vous faire ?",
      buttons: [
        [{ text: "Proposer des disponibilites", callbackData: "menu_schedule" }],
        [{ text: "Repondre a un devis", callbackData: "menu_quotes" }],
        [{ text: "Mes interventions", callbackData: "menu_interventions" }],
        [{ text: "Aide", callbackData: "menu_help" }],
      ],
    };
  }
  if (role === "proprietaire") {
    return {
      text: "Que souhaitez-vous faire ?",
      buttons: [
        [{ text: "Mes biens", callbackData: "menu_owner_biens" }],
        [{ text: "Incidents de mes biens", callbackData: "menu_owner_incidents" }],
        [{ text: "Mes echeances", callbackData: "menu_owner_echeances" }],
        [{ text: "Aide", callbackData: "menu_help" }],
      ],
    };
  }
  return {
    text: "Que souhaitez-vous faire ?",
    buttons: [
      [{ text: "Declarer un incident", callbackData: "menu_incident" }],
      [{ text: "Suivre mes incidents", callbackData: "menu_follow" }],
      [{ text: "Valider un rendez-vous", callbackData: "menu_tenant_schedule" }],
      [{ text: "Demander un document", callbackData: "menu_documents" }],
      [{ text: "Aide", callbackData: "menu_help" }],
    ],
  };
}
