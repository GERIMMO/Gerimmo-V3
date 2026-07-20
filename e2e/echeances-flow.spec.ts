import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

/**
 * Rappels d'échéance des documents officiels (assurance, diagnostic…).
 *
 * Parcours : créer un document officiel arrivant à échéance → il doit apparaître dans la
 * liste des échéances → envoyer le rappel → l'e-mail est mis en file pour le locataire et
 * le document est marqué « rappelé ».
 *
 * Ce test verrouille un correctif : `expiry_reminded_at` était écrit INCONDITIONNELLEMENT,
 * hors du bloc d'envoi. Un document pouvait donc être marqué « rappelé » sans qu'aucun
 * e-mail ne parte — plus personne ne relançait, et une assurance ou un diagnostic
 * obligatoire pouvait expirer sans que quiconque soit prévenu. D'où les deux assertions
 * qui comptent ici : l'e-mail EST en file, ET la marque n'est posée qu'avec lui.
 *
 * Fixtures : bien "E2E-BIEN-01" et le profil "Locataire E2E" (destinataire du rappel, il
 * doit avoir une adresse e-mail — sinon l'envoi est un cas métier légitimement ignoré).
 *
 * ⚠️ Ne pas enchaîner les exécutions : limitation de débit d'authentification Supabase.
 */
test("echeances : un document officiel proche de l'expiration declenche un rappel trace", async ({ page }) => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Identifiants E2E requis (E2E_USER_EMAIL / E2E_USER_PASSWORD).");

  // 1. Connexion
  await page.goto("/auth/v2/login");
  await page.getByLabel("Adresse e-mail").fill(E2E_EMAIL as string);
  await page.getByLabel("Mot de passe").fill(E2E_PASSWORD as string);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard\//);

  // 2. Retrouver le bien et le locataire fixtures
  const patrimoine = await page.request.get("/api/patrimoine");
  expect(patrimoine.ok(), `GET /api/patrimoine: ${await patrimoine.text()}`).toBeTruthy();
  const { biens } = (await patrimoine.json()) as {
    biens: Array<{ id: string; organization_id: string; reference: string }>;
  };
  const bien = biens.find((item) => item.reference === "E2E-BIEN-01");
  expect(bien, "Le bien fixture E2E-BIEN-01 doit exister.").toBeTruthy();

  const utilisateurs = await page.request.get("/api/utilisateurs");
  expect(utilisateurs.ok(), `GET /api/utilisateurs: ${await utilisateurs.text()}`).toBeTruthy();
  const { users } = (await utilisateurs.json()) as { users: Array<{ profile_id: string; full_name: string }> };
  const locataire = users.find((item) => item.full_name === "Locataire E2E");
  expect(locataire, "La fixture 'Locataire E2E' doit exister.").toBeTruthy();

  // 3. Créer un document officiel qui expire dans 10 jours, avec une alerte à 30 jours :
  //    il tombe donc dans la fenêtre de rappel.
  const expiration = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const marqueur = `E2E-ECHEANCE-${Date.now()}`;
  const creation = await page.request.post("/api/documents", {
    data: {
      organization_id: bien!.organization_id,
      bien_id: bien!.id,
      tenant_profile_id: locataire!.profile_id,
      title: `Attestation d assurance ${marqueur}`,
      reference: marqueur,
      document_type: "attestation",
      status: "actif",
      visibility: "locataire",
      official_document: true,
      expires_at: expiration,
      expiration_alert_days: 30,
    },
  });
  expect(creation.status(), `POST /api/documents: ${await creation.text()}`).toBe(201);
  const document = (await creation.json()) as { id: string };

  // 4. Le document doit remonter dans les échéances, pas encore rappelé
  const lireEcheances = async () => {
    const response = await page.request.get("/api/documents/reminders");
    expect(response.ok(), `GET /api/documents/reminders: ${await response.text()}`).toBeTruthy();
    return (
      (await response.json()) as {
        documents: Array<{ id: string; days_left: number; reminded_at: string | null }>;
      }
    ).documents;
  };

  const avant = (await lireEcheances()).find((item) => item.id === document.id);
  expect(avant, "Le document doit apparaitre dans les echeances a venir.").toBeTruthy();
  expect(avant?.days_left, "L echeance doit etre a une dizaine de jours.").toBeLessThanOrEqual(10);
  expect(avant?.reminded_at, "Aucun rappel ne doit encore avoir ete trace.").toBeNull();

  // 5. Envoyer le rappel
  const rappel = await page.request.post("/api/documents/reminders", { data: { documentId: document.id } });
  expect(rappel.ok(), `POST /api/documents/reminders: ${await rappel.text()}`).toBeTruthy();
  const { emailed } = (await rappel.json()) as { emailed: boolean };
  expect(emailed, "Le locataire ayant une adresse, l e-mail doit avoir ete mis en file.").toBe(true);

  // 6. L'e-mail est réellement en file ET la marque a été posée : les deux vont ensemble.
  const documents = await page.request.get("/api/documents");
  expect(documents.ok()).toBeTruthy();
  const { emails } = (await documents.json()) as {
    emails: Array<{ document_id: string; recipient_email: string; subject: string }>;
  };
  const envoi = emails.find((item) => item.document_id === document.id);
  expect(envoi, "Un e-mail de rappel doit etre en file pour ce document.").toBeTruthy();
  expect(envoi?.recipient_email).toBe("locataire.e2e@gerimmo.test");
  expect(envoi?.subject, "L objet doit annoncer le renouvellement.").toContain("renouveler");

  const apres = (await lireEcheances()).find((item) => item.id === document.id);
  expect(apres?.reminded_at, "Le document doit desormais porter la trace du rappel.").toBeTruthy();

  // 7. Nettoyage : archiver le document de test
  const archivage = await page.request.patch(`/api/documents/${document.id}`, { data: { action: "archive" } });
  expect(archivage.ok(), `PATCH archive: ${await archivage.text()}`).toBeTruthy();
});
