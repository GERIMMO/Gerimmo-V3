import { PDFDocument } from "pdf-lib";

import { buildMiseEnDemeurePdf, objetMiseEnDemeure } from "../src/lib/pdf/mise-en-demeure.ts";
import { objetRelance } from "../src/lib/pdf/relance-loyer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const donnees = {
  reference: "MED-202604-ABCD1234",
  bailleur: { nom: "Agence Horizon", adresse: ["3 place Bellecour", "69002 Lyon"], siren: "900123456" },
  locataire: { nom: "Marie Durand", adresse: ["14 rue des Tilleuls", "69007 Lyon"] },
  logement: ["14 rue des Tilleuls", "69007 Lyon"],
  echeances: [
    { periodeLabel: "avril 2026", echeanceLe: "05/04/2026", montantCents: 65000 },
    { periodeLabel: "mai 2026", echeanceLe: "05/05/2026", montantCents: 65000 },
  ],
  relancesLe: ["28/04/2026", "12/05/2026"],
  delaiJours: 8,
  lieuEtDate: "Fait a Lyon, le 20/07/2026",
};

test("la mise en demeure ne se confond avec aucune relance", () => {
  // Trois courriers partent au meme destinataire a quelques semaines d'intervalle. Si les
  // objets se ressemblent, le locataire ne percoit pas l'escalade et le bailleur ne peut pas
  // demontrer la gradation de ses demarches.
  const objets = [objetRelance(1, "avril 2026"), objetRelance(2, "avril 2026"), objetMiseEnDemeure("avril 2026")];
  assert.equal(new Set(objets).size, 3, "les trois objets doivent etre distincts");
  assert.match(objets[2], /MISE EN DEMEURE/);
});

test("le document est un PDF d'une page, correctement identifie", async () => {
  const octets = await buildMiseEnDemeurePdf(donnees);
  const relu = await PDFDocument.load(octets);
  assert.equal(relu.getTitle(), "MISE EN DEMEURE MED-202604-ABCD1234");
  assert.equal(relu.getPageCount(), 1, "la mise en demeure tient sur une page");
});

test("elle se genere meme sans relance prealable enregistree", async () => {
  // Cas reel : un loyer bascule en mise en demeure alors que l'historique des relances a ete
  // perdu ou n'a jamais ete trace. Le courrier doit rester emettable, sans phrase bancale.
  const octets = await buildMiseEnDemeurePdf({ ...donnees, relancesLe: [] });
  assert.ok(octets.byteLength > 1000);
});

test("l'elision du mois vaut aussi pour l'objet de la mise en demeure", () => {
  assert.match(objetMiseEnDemeure("avril 2026"), /loyer d'avril 2026/);
  assert.match(objetMiseEnDemeure("mars 2026"), /loyer de mars 2026/);
});
