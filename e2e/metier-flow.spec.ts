import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

/**
 * Parcours métier réel (mutations) : connexion → création d'un incident sur un bien du
 * périmètre → ouverture d'une demande de devis → vérifications → archivage (auto-nettoyage).
 * Nécessite E2E_USER_EMAIL / E2E_USER_PASSWORD (compte gestionnaire avec au moins un bien).
 * Fixture attendu : un bien de référence "E2E-BIEN-01" dans l'org du compte E2E.
 *
 * Ce test a révélé (et validé la correction de) un bug de production : créer/archiver un
 * incident — et de même un document, un devis, un comparatif, une intervention ou une
 * demande de créneaux — échouait pour tout utilisateur non super-admin, car la policy SELECT
 * re-interrogeait sa propre table (invisible pendant un INSERT/UPDATE ... RETURNING).
 * Voir les migrations 20260719130000 et 20260719140000.
 *
 * ⚠️ Enchaîner ce test trop souvent fait échouer la connexion ("Invalid login credentials")
 * à cause de la limitation de débit d'authentification Supabase — ce n'est pas une
 * régression. Laisser ~1 min entre deux exécutions rapprochées.
 */
test("parcours métier : incident + demande de devis, de la création à l'archivage", async ({ page }) => {
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

  // 5. Ouvrir une demande de devis sur cet incident (avec un artisan destinataire)
  const quoteTitle = `Devis ${marker}`;
  const createQuote = await page.request.post("/api/incidents/devis", {
    data: {
      organization_id: bien!.organization_id,
      incident_id: created.id,
      title: quoteTitle,
      recipients: [{ artisan_name: "Artisan E2E", artisan_scope: "prive" }],
    },
  });
  expect(createQuote.status(), `POST /api/incidents/devis: ${await createQuote.text()}`).toBe(201);
  const quoteRequest = (await createQuote.json()) as { id: string };
  expect(quoteRequest.id, "La demande de devis doit avoir un identifiant.").toBeTruthy();

  // 6. La retrouver dans la liste des devis
  const quoteList = await page.request.get("/api/incidents/devis");
  expect(quoteList.ok()).toBeTruthy();
  const { requests } = (await quoteList.json()) as { requests: Array<{ id: string; title: string }> };
  expect(
    requests.some((item) => item.id === quoteRequest.id && item.title === quoteTitle),
    "La demande de devis créée doit apparaître dans la liste.",
  ).toBeTruthy();

  // 7. Nettoyage : archiver la demande de devis puis l'incident
  const archiveQuote = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, {
    data: { action: "archive" },
  });
  expect(archiveQuote.ok(), `PATCH archive devis: ${archiveQuote.status()}`).toBeTruthy();

  const archive = await page.request.patch(`/api/incidents/${created.id}`, { data: { action: "archive" } });
  expect(archive.ok(), `PATCH archive incident: ${archive.status()}`).toBeTruthy();
});
