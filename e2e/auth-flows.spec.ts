import { expect, test } from "@playwright/test";

// Parcours d'authentification testables sans compte dédié (validation + sécurité).
// Le parcours connecté complet vit dans critical-flow.spec.ts (nécessite E2E_USER_*).

test("la connexion refuse des identifiants invalides sans exposer le dashboard", async ({ page }) => {
  await page.goto("/auth/v2/login");
  await page.getByLabel("Adresse e-mail").fill("inexistant.e2e@gerimmo.test");
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe-123");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\//);
});

test("la connexion valide la longueur minimale du mot de passe côté serveur", async ({ page }) => {
  await page.goto("/auth/v2/login");
  await page.getByLabel("Adresse e-mail").fill("test.e2e@gerimmo.test");
  await page.getByLabel("Mot de passe").fill("court");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByText(/au moins 8 caractères/)).toBeVisible();
  await expect(page).toHaveURL(/\/auth\//);
});

test("le lien mot de passe oublié mène à un formulaire de récupération", async ({ page }) => {
  await page.goto("/auth/v2/login");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();

  await expect(page).toHaveURL(/\/auth\/forgot-password/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
