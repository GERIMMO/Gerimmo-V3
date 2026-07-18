import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;

// Tous les écrans du dashboard accessibles à un compte propriétaire/agence.
const DASHBOARD_ROUTES = [
  "/dashboard/accueil",
  "/dashboard/a-faire",
  "/dashboard/biens",
  "/dashboard/proprietaires",
  "/dashboard/locataires",
  "/dashboard/artisans",
  "/dashboard/incidents",
  "/dashboard/incidents/devis",
  "/dashboard/incidents/devis/comparatif",
  "/dashboard/incidents/dossier",
  "/dashboard/incidents/planification",
  "/dashboard/documents",
  "/dashboard/communication",
  "/dashboard/echanges",
  "/dashboard/notifications",
  "/dashboard/rapports",
  "/dashboard/abonnement",
  "/dashboard/parametres",
  "/dashboard/parametres/telegram",
  "/dashboard/qualite/signaler",
  "/dashboard/utilisateurs",
  "/dashboard/onboarding",
];

test.describe("Balayage du dashboard connecté", () => {
  test.skip(!EMAIL || !PASSWORD, "Identifiants E2E requis (E2E_USER_EMAIL / E2E_USER_PASSWORD).");
  test.setTimeout(120_000);

  test("chaque écran du dashboard s'affiche sans crash ni erreur console", async ({ page }) => {
    await page.goto("/auth/v2/login");
    await page.getByLabel("Adresse e-mail").fill(EMAIL as string);
    await page.getByLabel("Mot de passe").fill(PASSWORD as string);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/dashboard\//);

    const problems: string[] = [];

    for (const route of DASHBOARD_ROUTES) {
      const errors: string[] = [];
      const onConsole = (msg: { type(): string; text(): string }) => {
        if (msg.type() === "error") errors.push(msg.text());
      };
      const onPageError = (err: Error) => errors.push(`CRASH: ${err.message}`);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);

      const response = await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => null);
      await page.waitForTimeout(400);
      page.off("console", onConsole);
      page.off("pageerror", onPageError);

      const status = response?.status() ?? 0;
      const mainVisible = await page
        .locator("main")
        .first()
        .isVisible()
        .catch(() => false);
      // Ignore les erreurs cosmétiques (favicon, ressources externes).
      const realErrors = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/i.test(e));

      if (status >= 500 || !mainVisible || realErrors.length > 0) {
        problems.push(`${route} → status=${status} main=${mainVisible} erreurs=[${realErrors.join(" || ")}]`);
      }
    }

    expect(problems, `Écrans en souci :\n${problems.join("\n")}`).toEqual([]);
  });
});
