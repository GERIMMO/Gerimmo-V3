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
 * Rôles de back-office. On accepte les clés de rôle ET les `member_type` bruts, car
 * findRole() retombe sur le member_type quand aucun rôle n'est attribué.
 */
const rolesBackOffice = new Set(["administrateur_agence", "agent_immobilier", "super_admin", "admin", "agent"]);

export function isBackOfficeRole(role: string) {
  return rolesBackOffice.has(role);
}

export function roleMenu(role: string): BotMenu {
  // Le back-office gère depuis le tableau de bord : le bot lui sert de fil de notifications
  // et de consultation rapide. Surtout, il ne doit PAS se voir proposer les actions d'un
  // locataire (« Declarer un incident », « Demander un document »), ce qui était le cas
  // auparavant faute de branche dédiée.
  if (isBackOfficeRole(role)) {
    return {
      text: "Vous recevez ici les notifications de votre agence. La gestion complete se fait sur votre tableau de bord GERIMMO.",
      buttons: [
        [{ text: "Incidents de l agence", callbackData: "menu_agency_incidents" }],
        [{ text: "Aide", callbackData: "menu_help" }],
      ],
    };
  }
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
