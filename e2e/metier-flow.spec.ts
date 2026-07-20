import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

/**
 * Parcours métier réel (mutations) : connexion → création d'un incident sur un bien du
 * périmètre → demande de devis à 2 artisans → envoi → réception d'une offre → sélection
 * de l'offre → vérifications → archivage (auto-nettoyage).
 *
 * Règle métier couverte : GERIMMO exige au moins 2 devis pour envoyer une demande, sauf
 * choix explicite d'un artisan privé unique (`allow_single_private_artisan`). Le trigger
 * validate_incident_quote_request_send() l'impose côté base.
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
test("parcours métier : incident → devis envoyé, reçu et retenu, puis archivage", async ({ page }) => {
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
      // Règle métier GERIMMO : au moins 2 devis pour pouvoir envoyer la demande
      // (sauf `allow_single_private_artisan` avec un unique artisan privé).
      // Voir le trigger validate_incident_quote_request_send().
      recipients: [
        { artisan_name: "Artisan E2E 1", artisan_scope: "prive" },
        { artisan_name: "Artisan E2E 2", artisan_scope: "prive" },
      ],
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

  // 7. Envoyer la demande à l'artisan
  const send = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, { data: { action: "send" } });
  expect(send.ok(), `PATCH send devis: ${await send.text()}`).toBeTruthy();

  // 8. Retrouver le destinataire créé avec la demande
  const withRecipients = await page.request.get("/api/incidents/devis");
  const { recipients } = (await withRecipients.json()) as {
    recipients: Array<{ id: string; quote_request_id: string }>;
  };
  const recipient = recipients.find((item) => item.quote_request_id === quoteRequest.id);
  expect(recipient, "Le destinataire de la demande de devis doit exister.").toBeTruthy();

  // 9. L'artisan renvoie une offre chiffrée
  const receive = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, {
    data: {
      action: "receive",
      quote: {
        organization_id: bien!.organization_id,
        recipient_id: recipient!.id,
        amount_cents: 45000,
      },
    },
  });
  expect(receive.ok(), `PATCH receive devis: ${await receive.text()}`).toBeTruthy();
  const quote = (await receive.json()) as { id: string };
  expect(quote.id, "L'offre reçue doit avoir un identifiant.").toBeTruthy();

  // 10. Retenir cette offre
  const select = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, {
    data: { action: "select", quote_id: quote.id },
  });
  expect(select.ok(), `PATCH select devis: ${await select.text()}`).toBeTruthy();

  // 11. Vérifier que la demande et l'offre sont bien passées en "retenu"
  const afterSelect = await page.request.get("/api/incidents/devis");
  const { requests: finalRequests, quotes } = (await afterSelect.json()) as {
    requests: Array<{ id: string; status: string }>;
    quotes: Array<{ id: string; status: string }>;
  };
  expect(
    finalRequests.find((item) => item.id === quoteRequest.id)?.status,
    "La demande de devis doit passer au statut 'retenu'.",
  ).toBe("retenu");
  expect(
    quotes.find((item) => item.id === quote.id)?.status,
    "L'offre sélectionnée doit passer au statut 'retenu'.",
  ).toBe("retenu");

  // 12. Nettoyage : archiver la demande de devis puis l'incident
  const archiveQuote = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, {
    data: { action: "archive" },
  });
  expect(archiveQuote.ok(), `PATCH archive devis: ${archiveQuote.status()}`).toBeTruthy();

  const archive = await page.request.patch(`/api/incidents/${created.id}`, { data: { action: "archive" } });
  expect(archive.ok(), `PATCH archive incident: ${archive.status()}`).toBeTruthy();
});
