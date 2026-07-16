import { expect, test } from "@playwright/test";

test("les surfaces critiques existent et restent protégées", async ({ page, request }) => {
  await page.goto("/auth/v2/login");
  await expect(page.getByRole("heading", { name: "GERIMMO V3" })).toBeVisible();
  for (const route of [
    "/dashboard/accueil",
    "/dashboard/a-faire",
    "/dashboard/abonnement",
    "/dashboard/artisans",
    "/dashboard/biens",
    "/dashboard/communication",
    "/dashboard/documents",
    "/dashboard/echanges",
    "/dashboard/locataires",
    "/dashboard/notifications",
    "/dashboard/onboarding",
    "/dashboard/parametres",
    "/dashboard/parametres/telegram",
    "/dashboard/proprietaires",
    "/dashboard/qualite/signaler",
    "/dashboard/rapports",
    "/dashboard/utilisateurs",
    "/dashboard/incidents",
    "/dashboard/incidents/devis",
    "/dashboard/incidents/devis/comparatif",
    "/dashboard/incidents/dossier",
    "/dashboard/incidents/planification",
    "/admin",
    "/admin/agencies",
    "/admin/bugs",
    "/admin/settings",
  ]) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(response.status());
  }
  for (const route of [
    "/api/admin",
    "/api/admin/imports",
    "/api/admin/supervision",
    "/api/articles",
    "/api/bot/telegram/admin",
    "/api/business",
    "/api/communication",
    "/api/documents",
    "/api/incidents",
    "/api/incidents/devis",
    "/api/incidents/devis/comparatif",
    "/api/incidents/finalisation",
    "/api/incidents/planification",
    "/api/onboarding",
    "/api/patrimoine",
    "/api/quality",
    "/api/utilisateurs",
  ]) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(401);
  }
});

test("le parcours public présente la valeur et mène à l'essai", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "GERIMMO", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Essai gratuit de 14 jours/ })).toBeVisible();
  for (const route of ["/tarifs", "/demonstration", "/aide", "/pourquoi-gerimmo", "/contact", "/demarrer"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("parcours client complet authentifié", async ({ page }) => {
  test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD, "Identifiants E2E dédiés requis.");
  await page.goto("/auth/v2/login");
  await page.getByLabel("Adresse e-mail").fill(process.env.E2E_USER_EMAIL as string);
  await page.getByLabel("Mot de passe").fill(process.env.E2E_USER_PASSWORD as string);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard\//);
  for (const route of [
    "/dashboard/biens",
    "/dashboard/locataires",
    "/dashboard/incidents",
    "/dashboard/documents",
    "/dashboard/incidents/devis",
    "/dashboard/incidents/dossier",
    "/dashboard/abonnement",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
  }
});
