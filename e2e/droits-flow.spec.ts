import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

/**
 * Hiérarchie de gestion des utilisateurs — un gérant doit pouvoir MODIFIER les personnes
 * dont il a la charge, et personne d'autre.
 *
 * Ce test verrouille un correctif de sécurité (migration 20260720130000) : jusque-là
 * profiles_update_policy n'autorisait que `id = auth.uid()` ou le super admin. Un gérant
 * ne pouvait pas corriger le téléphone d'un de ses locataires — et comme la modification
 * passe par la session de l'utilisateur, PostgREST renvoyait 204 avec 0 ligne modifiée :
 * l'application affichait un succès alors que RIEN n'était enregistré. D'où l'assertion
 * essentielle ici : on ne se contente pas d'un statut HTTP 200, on RELIT la valeur.
 *
 * Le compte E2E est un propriétaire bailleur (rôle `proprietaire`) de son organisation :
 * il gère donc les locataires de ses biens.
 *
 * Fixture attendue : le profil "Locataire E2E" doit être membre actif de l'organisation
 * du compte E2E (member_type `tenant`, rôle `locataire`), comme l'est un vrai locataire —
 * l'API exige une appartenance active à l'organisation supervisée.
 *
 * Non couvert ici (vérifié en base, non exposé par cette API) : le refus de s'auto-promouvoir
 * super administrateur, assuré par le trigger protect_profile_privileges().
 *
 * ⚠️ Ne pas enchaîner les exécutions : limitation de débit d'authentification Supabase.
 */
test("droits : un gérant modifie ses locataires, et seulement eux", async ({ page }) => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Identifiants E2E requis (E2E_USER_EMAIL / E2E_USER_PASSWORD).");

  // 1. Connexion
  await page.goto("/auth/v2/login");
  await page.getByLabel("Adresse e-mail").fill(E2E_EMAIL as string);
  await page.getByLabel("Mot de passe").fill(E2E_PASSWORD as string);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard\//);

  type User = {
    profile_id: string;
    organization_id: string;
    full_name: string;
    phone: string | null;
    role_key: string;
  };

  const readUsers = async () => {
    const response = await page.request.get("/api/utilisateurs");
    expect(response.ok(), `GET /api/utilisateurs: ${await response.text()}`).toBeTruthy();
    return ((await response.json()) as { users: User[] }).users;
  };

  // 2. Retrouver la locataire gérée par ce compte
  const users = await readUsers();
  const locataire = users.find((item) => item.full_name === "Locataire E2E");
  expect(locataire, "La fixture 'Locataire E2E' doit être visible du gérant.").toBeTruthy();
  expect(locataire!.role_key, "La fixture doit bien être un locataire.").toBe("locataire");

  // 3. Modifier son téléphone — la valeur est unique à chaque exécution pour qu'une
  //    ancienne donnée ne puisse pas faire passer le test par accident.
  const nouveauTelephone = `06${String(Date.now()).slice(-8)}`;
  const modification = await page.request.patch(`/api/utilisateurs/${locataire!.profile_id}`, {
    data: { organization_id: locataire!.organization_id, phone: nouveauTelephone },
  });
  expect(modification.ok(), `PATCH /api/utilisateurs: ${await modification.text()}`).toBeTruthy();

  // 4. RELIRE : c'est ici que se jouait le bug — un 200 sans aucun enregistrement.
  const apresModification = await readUsers();
  expect(
    apresModification.find((item) => item.profile_id === locataire!.profile_id)?.phone,
    "Le téléphone doit être réellement enregistré (un statut 200 ne suffit pas à le prouver).",
  ).toBe(nouveauTelephone);

  // 5. Étanchéité : un utilisateur hors de l'organisation supervisée doit être refusé.
  const inconnu = "00000000-0000-4000-8000-000000000000";
  const horsPerimetre = await page.request.patch(`/api/utilisateurs/${inconnu}`, {
    data: { organization_id: locataire!.organization_id, phone: "0600000000" },
  });
  expect(horsPerimetre.ok(), "Modifier un utilisateur hors de l'organisation supervisée doit être refusé.").toBeFalsy();
});
