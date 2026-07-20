import { roleMenu } from "../src/services/bot/menus.ts";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Menus du bot par rôle (WhatsApp et Telegram partagent roleMenu).
 *
 * Règle de conception retenue : menus complets pour locataire, artisan et propriétaire ;
 * actions rapides + notifications pour les rôles de back-office (agent immobilier,
 * administrateur d'agence, super admin).
 *
 * ⚠️ Les tests ci-dessous constatent le comportement ACTUEL, qui ne respecte pas encore la
 * seconde moitié de cette règle : les rôles de back-office tombent dans le cas par défaut
 * et reçoivent le menu LOCATAIRE. Voir le dernier test, qui documente ce trou plutôt que de
 * le masquer — il devra être réécrit le jour où le menu back-office existera.
 */

const libelles = (menu: ReturnType<typeof roleMenu>) => menu.buttons.flat().map((bouton) => bouton.text);
const actions = (menu: ReturnType<typeof roleMenu>) => menu.buttons.flat().map((bouton) => bouton.callbackData);

test("l'artisan recoit ses actions metier et aucune action de locataire", () => {
  const menu = roleMenu("artisan");
  assert.deepEqual(actions(menu), ["menu_schedule", "menu_quotes", "menu_interventions", "menu_help"]);
  assert.ok(!actions(menu).includes("menu_incident"), "un artisan ne declare pas d incident");
  assert.ok(!actions(menu).includes("menu_documents"), "un artisan ne demande pas de document locataire");
});

test("le proprietaire voit son parc, pas les actions d'un locataire", () => {
  const menu = roleMenu("proprietaire");
  assert.deepEqual(actions(menu), ["menu_owner_biens", "menu_owner_incidents", "menu_owner_echeances", "menu_help"]);
  assert.ok(!actions(menu).includes("menu_incident"), "un proprietaire ne declare pas d incident comme un locataire");
});

test("le locataire peut declarer, suivre, valider un rendez-vous et demander un document", () => {
  const menu = roleMenu("locataire");
  assert.deepEqual(actions(menu), [
    "menu_incident",
    "menu_follow",
    "menu_tenant_schedule",
    "menu_documents",
    "menu_help",
  ]);
});

test("chaque menu propose une aide et des libelles non vides", () => {
  for (const role of ["artisan", "proprietaire", "locataire", "inconnu"]) {
    const menu = roleMenu(role);
    assert.ok(menu.text.length > 0, `le menu ${role} doit poser une question`);
    assert.ok(menu.buttons.length > 0, `le menu ${role} doit proposer au moins un bouton`);
    assert.ok(
      libelles(menu).every((libelle) => libelle.trim().length > 0),
      `le menu ${role} ne doit pas contenir de bouton vide`,
    );
    assert.ok(actions(menu).includes("menu_help"), `le menu ${role} doit proposer une aide`);
  }
});

test("TROU CONNU : les roles de back-office heritent du menu locataire", () => {
  // findRole() renvoie la cle de role reelle ('administrateur_agence', 'agent_immobilier',
  // 'super_admin'), ou 'inconnu' si l'appartenance est introuvable. Aucune de ces valeurs
  // n'est traitee par roleMenu : toutes tombent dans le cas par defaut, celui du locataire.
  // Un administrateur d'agence se voit donc proposer « Declarer un incident » et « Demander
  // un document » comme s il etait locataire de son propre parc.
  const menuLocataire = roleMenu("locataire");
  for (const role of ["administrateur_agence", "agent_immobilier", "super_admin", "inconnu"]) {
    assert.deepEqual(
      actions(roleMenu(role)),
      actions(menuLocataire),
      `${role} recoit aujourd hui le menu locataire — a corriger quand le menu back-office existera`,
    );
  }
});
