import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

test.describe("Interactions dashboard (vrais boutons d'action)", () => {
  test.skip(!EMAIL || !PASSWORD, "Identifiants E2E requis.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/v2/login");
    await page.getByLabel("Adresse e-mail").fill(EMAIL as string);
    await page.getByLabel("Mot de passe").fill(PASSWORD as string);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/dashboard\//);
  });

  test("créer un patrimoine : bouton → panneau → formulaire → enregistrement", async ({ page }) => {
    await page.goto("/dashboard/biens");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000); // hydratation React

    // Ouvre le panneau de création de patrimoine.
    const patrimoineButton = page.getByRole("button", { name: "Patrimoine", exact: true });
    await expect(patrimoineButton).toBeEnabled();
    await patrimoineButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Remplit et soumet.
    const reference = `QA-PAT-${Date.now()}`;
    await dialog.locator("#resource-name").fill("Patrimoine QA automatisé");
    await dialog.locator("#resource-reference").fill(reference);
    await dialog.getByRole("button", { name: "Créer", exact: true }).click();

    // Succès = le panneau se ferme (sur erreur il reste ouvert).
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // Le patrimoine est persisté : après rechargement, le bouton "Bien" est actif.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Bien", exact: true })).toBeEnabled();
  });
});
