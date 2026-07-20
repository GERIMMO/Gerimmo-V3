import { expect, test } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;

/**
 * Parcours métier réel (mutations) : connexion → création d'un incident sur un bien du
 * périmètre → demande de devis à 2 artisans → envoi → réception des 2 offres →
 * comparatif (avec recommandation calculée par la base) → sélection de l'offre
 * recommandée → demande de créneaux → 3 disponibilités proposées → acceptation directe
 * du responsable → vérifications → archivage (auto-nettoyage).
 *
 * Choix assumé : l'étape de planification est pilotée par le seul compte gestionnaire
 * (`acceptation_directe`), ce qui évite d'orchestrer un 2e compte artisan/locataire.
 * Le chemin multi-rôles (l'artisan propose, le locataire choisit via `choix_locataire`)
 * reste à couvrir séparément.
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
test("parcours métier : incident → devis → comparatif → planification validée", async ({ page }) => {
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

  // 8. Retrouver les destinataires créés avec la demande
  const withRecipients = await page.request.get("/api/incidents/devis");
  const { recipients } = (await withRecipients.json()) as {
    recipients: Array<{ id: string; quote_request_id: string; artisan_name: string }>;
  };
  const ourRecipients = recipients.filter((item) => item.quote_request_id === quoteRequest.id);
  expect(ourRecipients.length, "Les 2 artisans destinataires doivent exister.").toBe(2);

  // 9. Chaque artisan renvoie une offre chiffrée
  const offers: Array<{ id: string; recipient_id: string; amount_cents: number; received_at: string }> = [];
  for (const [index, artisan] of ourRecipients.entries()) {
    const receive = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, {
      data: {
        action: "receive",
        quote: {
          organization_id: bien!.organization_id,
          recipient_id: artisan.id,
          amount_cents: 45000 + index * 7000,
        },
      },
    });
    expect(receive.ok(), `PATCH receive devis: ${await receive.text()}`).toBeTruthy();
    offers.push(await receive.json());
  }
  expect(offers.length, "Deux offres doivent avoir été reçues.").toBe(2);

  // 10. Construire le comparatif des deux offres (déclenche le calcul de recommandation)
  const createComparison = await page.request.post("/api/incidents/devis/comparatif", {
    data: {
      organization_id: bien!.organization_id,
      quote_request_id: quoteRequest.id,
      items: offers.map((offer, index) => ({
        quote_id: offer.id,
        recipient_id: offer.recipient_id,
        artisan_name: ourRecipients[index].artisan_name,
        price_cents: offer.amount_cents,
        received_at: offer.received_at,
        gerimmo_rating: index === 0 ? 5 : 3,
        administrative_documents_valid: true,
      })),
    },
  });
  expect(createComparison.status(), `POST comparatif: ${await createComparison.text()}`).toBe(201);
  const comparison = (await createComparison.json()) as { id: string };

  // 11. Vérifier que le comparatif contient les 2 offres et qu'une recommandation est calculée
  const comparisonList = await page.request.get("/api/incidents/devis/comparatif");
  expect(comparisonList.ok()).toBeTruthy();
  const { items: comparisonItems } = (await comparisonList.json()) as {
    items: Array<{
      comparison_id: string;
      quote_id: string;
      recipient_id: string;
      is_recommended: boolean;
      recommendation_score: number;
    }>;
  };
  const ourItems = comparisonItems.filter((item) => item.comparison_id === comparison.id);
  expect(ourItems.length, "Le comparatif doit contenir les 2 offres.").toBe(2);
  const recommended = ourItems.find((item) => item.is_recommended);
  expect(recommended, "Une offre doit être recommandée automatiquement.").toBeTruthy();

  // 12. Retenir l'offre recommandée
  const select = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, {
    data: { action: "select", quote_id: recommended!.quote_id },
  });
  expect(select.ok(), `PATCH select devis: ${await select.text()}`).toBeTruthy();
  const quote = { id: recommended!.quote_id };

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

  // 13. Ouvrir une demande de créneaux auprès de l'artisan retenu
  const createSchedule = await page.request.post("/api/incidents/planification", {
    data: {
      organization_id: bien!.organization_id,
      incident_id: created.id,
      quote_request_id: quoteRequest.id,
      accepted_quote_id: recommended!.quote_id,
      quote_recipient_id: recommended!.recipient_id,
    },
  });
  expect(createSchedule.status(), `POST planification: ${await createSchedule.text()}`).toBe(201);
  const schedule = (await createSchedule.json()) as { id: string };

  // 14. L'artisan propose ses disponibilités (GERIMMO en exige au moins 3)
  const slotAt = (daysAhead: number, hour: number) => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + daysAhead);
    start.setUTCHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(hour + 2);
    return { starts_at: start.toISOString(), ends_at: end.toISOString() };
  };
  const propose = await page.request.patch(`/api/incidents/planification/${schedule.id}`, {
    data: {
      action: "proposer_creneaux",
      organization_id: bien!.organization_id,
      artisan_comment: "Disponibilités E2E",
      slots: [slotAt(7, 9), slotAt(8, 14), slotAt(9, 10)],
    },
  });
  expect(propose.ok(), `PATCH proposer_creneaux: ${await propose.text()}`).toBeTruthy();

  // 15. Retrouver les créneaux proposés
  const scheduleList = await page.request.get("/api/incidents/planification");
  expect(scheduleList.ok()).toBeTruthy();
  const { slots } = (await scheduleList.json()) as {
    slots: Array<{ id: string; schedule_request_id: string; starts_at: string; ends_at: string }>;
  };
  const ourSlots = slots.filter((slot) => slot.schedule_request_id === schedule.id);
  expect(ourSlots.length, "Les 3 créneaux proposés doivent être enregistrés.").toBe(3);

  // 16. Le responsable retient directement un créneau (sans passer par le locataire)
  const accept = await page.request.patch(`/api/incidents/planification/${schedule.id}`, {
    data: { action: "acceptation_directe", actor_role: "responsable", slot_id: ourSlots[0].id },
  });
  expect(accept.ok(), `PATCH acceptation_directe: ${await accept.text()}`).toBeTruthy();

  // 17. Vérifier que le rendez-vous est validé sur le bon créneau
  const afterSchedule = await page.request.get("/api/incidents/planification");
  const { requests: scheduleRequests } = (await afterSchedule.json()) as {
    requests: Array<{ id: string; status: string; selected_slot_id: string | null }>;
  };
  const finalSchedule = scheduleRequests.find((item) => item.id === schedule.id);
  expect(finalSchedule?.status, "La planification doit être validée.").toBe("valide");
  expect(finalSchedule?.selected_slot_id, "Le créneau retenu doit être enregistré.").toBe(ourSlots[0].id);

  // 18. Créer l'intervention sur le créneau retenu
  const retainedSlot = ourSlots[0];
  const createIntervention = await page.request.post("/api/incidents/finalisation", {
    data: {
      organization_id: bien!.organization_id,
      incident_id: created.id,
      bien_id: bien!.id,
      schedule_request_id: schedule.id,
      selected_slot_id: retainedSlot.id,
      accepted_quote_id: recommended!.quote_id,
      quote_recipient_id: recommended!.recipient_id,
      planned_starts_at: retainedSlot.starts_at,
      planned_ends_at: retainedSlot.ends_at,
      execution_mode: "artisan_prive",
      work_description: "Réparation E2E",
    },
  });
  expect(createIntervention.status(), `POST intervention: ${await createIntervention.text()}`).toBe(201);
  const intervention = (await createIntervention.json()) as { id: string };

  // 19. Démarrer puis terminer l'intervention
  const start = await page.request.patch(`/api/incidents/finalisation/${intervention.id}`, {
    data: { action: "demarrer" },
  });
  expect(start.ok(), `PATCH demarrer: ${await start.text()}`).toBeTruthy();

  const complete = await page.request.patch(`/api/incidents/finalisation/${intervention.id}`, {
    data: { action: "terminer", final_amount_cents: 45000, artisan_comment: "Intervention réalisée" },
  });
  expect(complete.ok(), `PATCH terminer: ${await complete.text()}`).toBeTruthy();

  // 20. Produire le rapport d'intervention
  const createReport = await page.request.post("/api/incidents/finalisation", {
    data: { type: "rapport", intervention_id: intervention.id, observations: "Rapport E2E" },
  });
  expect(createReport.status(), `POST rapport: ${await createReport.text()}`).toBe(201);
  const report = (await createReport.json()) as { id: string };

  // 21. Clôturer l'incident sur la base de ce rapport
  const createClosure = await page.request.post("/api/incidents/finalisation", {
    data: {
      type: "cloture",
      organization_id: bien!.organization_id,
      incident_id: created.id,
      intervention_id: intervention.id,
      report_id: report.id,
      action: "cloture_normale",
      comment: "Clôture E2E",
    },
  });
  expect(createClosure.status(), `POST cloture: ${await createClosure.text()}`).toBe(201);

  // 22. Vérifier l'intervention terminée et la clôture enregistrée
  const finalization = await page.request.get("/api/incidents/finalisation");
  expect(finalization.ok()).toBeTruthy();
  const { interventions, closures } = (await finalization.json()) as {
    interventions: Array<{ id: string; status: string }>;
    closures: Array<{ incident_id: string; action: string }>;
  };
  expect(interventions.find((item) => item.id === intervention.id)?.status, "L'intervention doit être terminée.").toBe(
    "terminee",
  );
  expect(
    closures.some((item) => item.incident_id === created.id && item.action === "cloture_normale"),
    "La clôture de l'incident doit être enregistrée.",
  ).toBeTruthy();

  // 23. Nettoyage : archiver la demande de devis puis l'incident
  const archiveQuote = await page.request.patch(`/api/incidents/devis/${quoteRequest.id}`, {
    data: { action: "archive" },
  });
  expect(archiveQuote.ok(), `PATCH archive devis: ${archiveQuote.status()}`).toBeTruthy();

  const archive = await page.request.patch(`/api/incidents/${created.id}`, { data: { action: "archive" } });
  expect(archive.ok(), `PATCH archive incident: ${archive.status()}`).toBeTruthy();
});
