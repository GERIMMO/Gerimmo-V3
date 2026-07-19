import { applyBrandIdentity, gerimmoIdentity, roleRequiresGerimmo } from "../src/services/bot/brand-rules.ts";
import {
  allowedTenantDocumentTypes,
  classifyMessage,
  parseAvailabilitySlots,
  parseEurosToCents,
} from "../src/services/bot/message-understanding.ts";
import assert from "node:assert/strict";
import test from "node:test";

test("classe une fuite comme incident de plomberie", () => {
  const result = classifyMessage("J ai une fuite d eau sous le robinet de la salle de bain");
  assert.equal(result.intent, "declarer_incident");
  assert.equal(result.categorySlug, "plomberie");
  assert.ok(result.confidence >= 0.8);
  assert.equal(result.needsClarification, false);
});

test("ne fabrique pas une intention lorsque le message est ambigu", () => {
  const result = classifyMessage("Bonjour, je souhaite parler a quelqu un");
  assert.equal(result.intent, "inconnu");
  assert.equal(result.categorySlug, null);
  assert.equal(result.needsClarification, true);
});

test("reconnait une demande de suivi", () => {
  assert.equal(classifyMessage("Ou en est mon dossier ?").intent, "suivre_incident");
});

test("reconnait une demande de document", () => {
  assert.equal(classifyMessage("Je souhaite recevoir ma quittance").intent, "demander_document");
});

test("analyse au moins trois creneaux artisan valides", () => {
  const slots = parseAvailabilitySlots("2026-08-01 09:00-11:00\n2026-08-02 14:00-16:00\n2026-08-03 10:00-12:00");
  assert.equal(slots.length, 3);
  assert.ok(slots.every((slot) => new Date(slot.ends_at) > new Date(slot.starts_at)));
});

test("ignore les disponibilites dont le format est invalide", () => {
  assert.equal(parseAvailabilitySlots("demain matin, apres-demain midi").length, 0);
});

test("limite les documents locataire aux types autorises", () => {
  assert.equal(allowedTenantDocumentTypes.has("quittance"), true);
  assert.equal(allowedTenantDocumentTypes.has("contrat"), true);
  assert.equal(allowedTenantDocumentTypes.has("devis"), false);
  assert.equal(allowedTenantDocumentTypes.has("rapport_incident"), false);
});

test("analyse un montant de devis en euros vers des centimes", () => {
  assert.equal(parseEurosToCents("250"), 25000);
  assert.equal(parseEurosToCents("250,50"), 25050);
  assert.equal(parseEurosToCents("250.5"), 25050);
  assert.equal(parseEurosToCents("1 200 €"), 120000);
  assert.equal(parseEurosToCents("abc"), null);
  assert.equal(parseEurosToCents("12,345"), null);
});

test("impose GERIMMO aux artisans", () => {
  assert.equal(roleRequiresGerimmo("artisan"), true);
  assert.equal(roleRequiresGerimmo("contractor"), true);
  assert.equal(roleRequiresGerimmo("locataire"), false);
});

test("applique la signature et les coordonnees de la marque", () => {
  const message = applyBrandIdentity("Votre dossier est pris en charge.", {
    ...gerimmoIdentity,
    customized: true,
    displayName: "Martin Immobilier",
    supportSignature: "L equipe Martin Immobilier",
    supportPhone: "01 02 03 04 05",
  });
  assert.match(message, /Martin Immobilier/);
  assert.match(message, /01 02 03 04 05/);
});
