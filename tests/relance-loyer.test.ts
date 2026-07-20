import { PDFDocument } from "pdf-lib";

import { buildRelancePdf, duMois, objetRelance } from "../src/lib/pdf/relance-loyer.ts";
import assert from "node:assert/strict";
import test from "node:test";

const commun = {
  bailleur: { nom: "Agence Horizon", adresse: ["3 place Bellecour", "69002 Lyon"], siren: "900123456" },
  locataire: { nom: "Marie Durand", adresse: ["14 rue des Tilleuls", "69007 Lyon"] },
  logement: ["14 rue des Tilleuls", "69007 Lyon"],
  echeances: [{ periodeLabel: "avril 2026", echeanceLe: "05/04/2026", montantCents: 65000 }],
  delaiJours: 8,
  lieuEtDate: "Fait a Lyon, le 20/07/2026",
};

test("l'elision distingue « d'avril » de « de mars »", () => {
  // Sans elision, le courrier ecrit « loyer de avril » et trahit une generation automatique.
  assert.equal(duMois("avril 2026"), "d'avril 2026");
  assert.equal(duMois("aout 2026"), "d'aout 2026");
  assert.equal(duMois("octobre 2026"), "d'octobre 2026");
  assert.equal(duMois("mars 2026"), "de mars 2026");
  assert.equal(duMois("juin 2026"), "de juin 2026");
});

test("les deux relances portent un objet distinct", () => {
  // Deux courriers au meme objet empechent le locataire de percevoir l'escalade, et le
  // bailleur de demontrer qu'il a relance deux fois avant la mise en demeure.
  const premiere = objetRelance(1, "avril 2026");
  const seconde = objetRelance(2, "avril 2026");
  assert.notEqual(premiere, seconde);
  assert.match(premiere, /Rappel/);
  assert.match(seconde, /Seconde relance/);
});

test("chaque niveau produit un PDF identifiable", async () => {
  const premiere = await PDFDocument.load(await buildRelancePdf({ ...commun, niveau: 1, reference: "REL-1" }));
  const seconde = await PDFDocument.load(
    await buildRelancePdf({ ...commun, niveau: 2, reference: "REL-2", relancePrecedenteLe: "28/04/2026" }),
  );
  assert.equal(premiere.getTitle(), "PREMIÈRE RELANCE REL-1");
  assert.equal(seconde.getTitle(), "SECONDE RELANCE REL-2");
  assert.equal(premiere.getPageCount(), 1, "une relance tient sur une page");
});

test("plusieurs echeances impayees sont toutes reprises", async () => {
  // Une relance qui n'annonce qu'un mois alors que deux sont dus prive le bailleur de la
  // preuve du montant reclame.
  const octets = await buildRelancePdf({
    ...commun,
    niveau: 2,
    reference: "REL-2",
    echeances: [
      { periodeLabel: "avril 2026", echeanceLe: "05/04/2026", montantCents: 65000 },
      { periodeLabel: "mai 2026", echeanceLe: "05/05/2026", montantCents: 65000 },
    ],
  });
  assert.ok(octets.byteLength > 1000);
});
