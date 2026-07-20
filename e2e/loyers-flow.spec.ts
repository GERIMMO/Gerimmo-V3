import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

/**
 * Parcours loyers (mutations réelles) — les deux issues d'un appel de loyer :
 *
 *  A. Loyer reçu   : génération de la période → confirmation "reçu" → quittance créée en
 *                    attente de validation humaine → validation → document actif + e-mail
 *                    déposé dans document_email_outbox (envoi réel délégué à n8n).
 *  B. Loyer impayé : confirmation "non reçu" → relance 1 → relance 2 → mise en demeure.
 *                    La bascule est portée par reminder_count (>= 2 ⇒ mise en demeure),
 *                    conformément à la règle retenue : 2 relances puis mise en demeure.
 *
 * Les deux branches utilisent deux mois différents pour la même location, ce qui évite
 * d'avoir à créer un second bien.
 *
 * Fixtures attendues dans l'org du compte E2E :
 *   - bien "E2E-BIEN-01" avec un loyer mensuel renseigné (60000 centimes) ;
 *   - une occupation active de type "locataire" ("Locataire E2E") rattachée à un profil
 *     disposant d'une adresse e-mail — sans profil ni e-mail, l'étape d'envoi de la
 *     quittance est silencieusement ignorée et la branche A ne prouverait rien.
 *
 * Le compte E2E n'est délibérément PAS super-admin : la génération des périodes s'appuie
 * sur la RLS pour rester cantonnée à son organisation.
 *
 * ⚠️ Ne pas enchaîner les exécutions : la limitation de débit d'authentification Supabase
 * fait échouer la connexion ("Invalid login credentials") — ce n'est pas une régression.
 */
test("parcours loyers : quittance validée d'un côté, mise en demeure de l'autre", async ({ page }) => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Identifiants E2E requis (E2E_USER_EMAIL / E2E_USER_PASSWORD).");

  // 1. Connexion
  await page.goto("/auth/v2/login");
  await page.getByLabel("Adresse e-mail").fill(E2E_EMAIL as string);
  await page.getByLabel("Mot de passe").fill(E2E_PASSWORD as string);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard\//);

  type RentPeriod = {
    id: string;
    period_month: string;
    status: string;
    amount_cents: number;
    reminder_count: number;
    quittance_status: string | null;
  };

  type DocumentsPayload = {
    documents: Array<{
      id: string;
      title: string;
      status: string;
      document_type: string;
      metadata: Record<string, unknown> | null;
    }>;
    emails: Array<{ document_id: string; recipient_email: string; subject: string }>;
  };

  const readDocuments = async () => {
    const response = await page.request.get("/api/documents");
    expect(response.ok(), `GET /api/documents: ${await response.text()}`).toBeTruthy();
    return (await response.json()) as DocumentsPayload;
  };

  // Les documents produits par le module loyers portent l'id de la période dans metadata.
  const pourPeriode = (payload: DocumentsPayload, periodId: string) =>
    payload.documents.filter(
      (item) => (item.metadata as { rent_period_id?: string } | null)?.rent_period_id === periodId,
    );

  const readPeriods = async () => {
    const response = await page.request.get("/api/rent");
    expect(response.ok(), `GET /api/rent: ${await response.text()}`).toBeTruthy();
    return ((await response.json()) as { periods: RentPeriod[] }).periods;
  };

  // 2. Générer les périodes de loyer de deux mois distincts (une par branche).
  //    L'appel est idempotent : il ne crée que ce qui manque.
  const moisRecu = "2026-03-01";
  const moisImpaye = "2026-04-01";
  for (const month of [moisRecu, moisImpaye]) {
    const generate = await page.request.post("/api/rent", { data: { month } });
    expect(generate.ok(), `POST /api/rent (${month}): ${await generate.text()}`).toBeTruthy();
  }

  const periodsApresGeneration = await readPeriods();
  const periodeRecue = periodsApresGeneration.find((item) => item.period_month.startsWith(moisRecu.slice(0, 7)));
  const periodeImpayee = periodsApresGeneration.find((item) => item.period_month.startsWith(moisImpaye.slice(0, 7)));
  expect(periodeRecue, `Une période de loyer doit exister pour ${moisRecu}.`).toBeTruthy();
  expect(periodeImpayee, `Une période de loyer doit exister pour ${moisImpaye}.`).toBeTruthy();
  expect(periodeRecue!.amount_cents, "Le loyer doit reprendre le montant du bien.").toBe(60000);

  // ── Branche A : le loyer est reçu ────────────────────────────────────────────────────
  // 3. Confirmer la réception → génère la quittance en attente de validation humaine
  const confirmeRecu = await page.request.patch("/api/rent", {
    data: { periodId: periodeRecue!.id, received: true },
  });
  expect(confirmeRecu.ok(), `PATCH /api/rent (reçu): ${await confirmeRecu.text()}`).toBeTruthy();

  const apresConfirmation = await readPeriods();
  const recue = apresConfirmation.find((item) => item.id === periodeRecue!.id);
  expect(recue?.status, "Le loyer confirmé doit passer à 'recu'.").toBe("recu");
  expect(recue?.quittance_status, "La quittance doit attendre une validation humaine.").toBe("a_valider");

  // La quittance existe mais reste un brouillon tant qu'un humain ne l'a pas validée.
  const avantValidation = pourPeriode(await readDocuments(), periodeRecue!.id);
  const brouillon = avantValidation.find((item) => item.document_type === "quittance");
  expect(brouillon, "Une quittance doit avoir été générée.").toBeTruthy();
  expect(brouillon?.status, "La quittance non validée doit rester un brouillon.").toBe("brouillon");

  // 4. Valider la quittance → document actif + e-mail au locataire mis en file
  const validation = await page.request.post("/api/rent/quittance", {
    data: { periodId: periodeRecue!.id },
  });
  expect(validation.ok(), `POST /api/rent/quittance: ${await validation.text()}`).toBeTruthy();

  const apresValidation = await readPeriods();
  expect(
    apresValidation.find((item) => item.id === periodeRecue!.id)?.quittance_status,
    "La quittance validée ne doit plus être 'a_valider'.",
  ).not.toBe("a_valider");

  // 5. La quittance devient active et l'e-mail au locataire est déposé pour envoi
  const documentsApresValidation = await readDocuments();
  const quittance = pourPeriode(documentsApresValidation, periodeRecue!.id).find(
    (item) => item.document_type === "quittance",
  );
  expect(quittance?.status, "La quittance validée doit être active.").toBe("actif");

  const envoi = documentsApresValidation.emails.find((item) => item.document_id === quittance!.id);
  expect(envoi, "La quittance validée doit être mise en file d'envoi vers le locataire.").toBeTruthy();
  expect(envoi?.recipient_email, "L'e-mail doit partir vers le locataire du bien.").toBe("locataire.e2e@gerimmo.test");

  // ── Branche B : le loyer est impayé ──────────────────────────────────────────────────
  // 6. Confirmer le non-paiement
  const confirmeImpaye = await page.request.patch("/api/rent", {
    data: { periodId: periodeImpayee!.id, received: false },
  });
  expect(confirmeImpaye.ok(), `PATCH /api/rent (impayé): ${await confirmeImpaye.text()}`).toBeTruthy();

  const apresImpaye = await readPeriods();
  expect(
    apresImpaye.find((item) => item.id === periodeImpayee!.id)?.status,
    "Le loyer non reçu doit passer à 'impaye'.",
  ).toBe("impaye");

  // 7. Deux relances, puis la mise en demeure au 3e envoi
  for (const rang of [1, 2, 3]) {
    const relance = await page.request.post("/api/rent/reminder", {
      data: { periodId: periodeImpayee!.id },
    });
    expect(relance.ok(), `POST /api/rent/reminder (${rang}): ${await relance.text()}`).toBeTruthy();
  }

  // Le compteur ne dénombre que les RELANCES : la mise en demeure, elle, est matérialisée
  // par le statut du loyer (et mise_en_demeure_at), pas par un incrément supplémentaire.
  const apresRelances = await readPeriods();
  const impayeeFinale = apresRelances.find((item) => item.id === periodeImpayee!.id);
  expect(impayeeFinale?.reminder_count, "Deux relances doivent avoir été comptabilisées.").toBe(2);
  expect(impayeeFinale?.status, "Le 3e envoi doit faire basculer le loyer en mise en demeure.").toBe("mise_en_demeure");

  // 8. Une fois la mise en demeure émise, le loyer n'est plus "impaye" : une relance
  //    supplémentaire doit être refusée (pas d'empilement de mises en demeure).
  const relanceDeTrop = await page.request.post("/api/rent/reminder", {
    data: { periodId: periodeImpayee!.id },
  });
  expect(relanceDeTrop.ok(), "Relancer après la mise en demeure doit être refusé.").toBeFalsy();

  // 9. Vérifier les courriers produits : 2 relances puis 1 mise en demeure
  const liesAuLoyer = pourPeriode(await readDocuments(), periodeImpayee!.id);
  const relances = liesAuLoyer.filter((item) => (item.metadata as { kind?: string }).kind === "relance");
  const misesEnDemeure = liesAuLoyer.filter((item) => (item.metadata as { kind?: string }).kind === "mise_en_demeure");
  expect(relances.length, "Il doit y avoir exactement 2 relances avant la mise en demeure.").toBe(2);
  expect(misesEnDemeure.length, "Le 3e envoi doit être une mise en demeure.").toBe(1);
});
