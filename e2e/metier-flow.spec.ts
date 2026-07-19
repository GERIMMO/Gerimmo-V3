import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

/**
 * Parcours métier réel (mutations) : connexion, création d'un incident sur un bien du
 * périmètre, vérification qu'il apparaît, puis archivage (auto-nettoyage).
 * Nécessite E2E_USER_EMAIL / E2E_USER_PASSWORD (compte gestionnaire avec au moins un bien).
 * Fixture attendu : un bien de référence "E2E-BIEN-01" dans l'org du compte E2E.
 *
 * ⚠️ BUG CONNU révélé par ce test (2026-07-19) : la création d'incident par un utilisateur
 * NON super-admin échoue en production (HTTP 500). Les logs Postgres montrent une violation
 * RLS sur `observability_events` (policy insert = `profile_id = auth.uid() OR profile_id IS NULL`),
 * écrite par l'instrumentation applicative — elle masque probablement l'erreur primaire de
 * createIncident. À corriger avant que ce test passe au vert. Il ne s'exécute qu'avec des
 * identifiants E2E (donc ignoré en CI standard).
 */
test("parcours métier : créer, retrouver et archiver un incident", async ({ page }) => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Identifiants E2E requis (E2E_USER_EMAIL / E2E_USER_PASSWORD).");

  // 1. Connexion
  await page.goto("/auth/v2/login");
  await page.getByLabel("Adresse e-mail").fill(E2E_EMAIL as string);
  await page.getByLabel("Mot de passe").fill(E2E_PASSWORD as string);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard\//);

  // 2. Récupérer un bien du périmètre (via l'API réelle, session authentifiée partagée)
  const patrimoine = await page.request.get("/api/patrimoine");
  expect(patrimoine.ok(), `GET /api/patrimoine: ${patrimoine.status()}`).toBeTruthy();
  const { biens } = (await patrimoine.json()) as {
    biens: Array<{ id: string; organization_id: string; reference: string }>;
  };
  expect(biens.length, "Le compte E2E doit avoir au moins un bien.").toBeGreaterThan(0);
  const bien = biens.find((item) => item.reference === "E2E-BIEN-01");
  expect(bien, "Le bien fixture E2E-BIEN-01 doit être visible par le compte E2E.").toBeTruthy();

  // 3. Créer un incident
  const marker = `E2E incident ${Date.now()}`;
  const create = await page.request.post("/api/incidents", {
    data: {
      organization_id: bien!.organization_id,
      bien_id: bien!.id,
      category: "plomberie",
      description: marker,
      priority: "normale",
    },
  });
  expect(create.status(), `POST /api/incidents: ${await create.text()}`).toBe(201);
  const created = (await create.json()) as { id: string; number?: string };
  expect(created.id, "L'incident créé doit avoir un identifiant.").toBeTruthy();

  // 4. Le retrouver dans la liste
  const list = await page.request.get("/api/incidents");
  expect(list.ok()).toBeTruthy();
  const { incidents } = (await list.json()) as { incidents: Array<{ id: string; description: string }> };
  expect(
    incidents.some((incident) => incident.id === created.id && incident.description === marker),
    "L'incident créé doit apparaître dans la liste.",
  ).toBeTruthy();

  // 5. Nettoyage : archiver l'incident créé
  const archive = await page.request.patch(`/api/incidents/${created.id}`, { data: { action: "archive" } });
  expect(archive.ok(), `PATCH archive: ${archive.status()}`).toBeTruthy();
});
