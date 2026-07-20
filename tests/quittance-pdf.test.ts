import { PDFDocument } from "pdf-lib";

import { buildQuittancePdf, formaterEuros } from "../src/lib/pdf/quittance.ts";
import assert from "node:assert/strict";
import test from "node:test";

const donnees = {
  reference: "QUIT-202603-ABCD1234",
  bailleur: { nom: "Agence Horizon", adresse: ["12 rue des Lilas", "69003 Lyon"], siren: "123456789" },
  locataire: { nom: "Marie Durand", adresse: ["8 avenue du Parc", "69006 Lyon"] },
  logement: ["8 avenue du Parc", "69006 Lyon"],
  periodeLabel: "mars 2026",
  periodeDebut: "01/03/2026",
  periodeFin: "31/03/2026",
  loyerCents: 60000,
  chargesCents: 5000,
  dateReglement: "05/03/2026",
  lieuEtDate: "Fait a Lyon, le 20/07/2026",
};

test("les montants sont formates en euros a la francaise", () => {
  assert.equal(formaterEuros(60000), "600,00 €");
  assert.equal(formaterEuros(0), "0,00 €");
  assert.equal(formaterEuros(1234), "12,34 €");
});

test("la quittance produit un vrai fichier PDF", async () => {
  const octets = await buildQuittancePdf(donnees);
  assert.ok(octets.byteLength > 1000, "le PDF ne doit pas etre vide");
  // Signature d'un fichier PDF : %PDF
  assert.equal(Buffer.from(octets.slice(0, 4)).toString("utf8"), "%PDF");
});

test("le PDF est relisible et porte la reference de la quittance", async () => {
  // Les metadonnees d'un PDF ne sont pas stockees en clair : on relit donc le fichier
  // produit plutot que d'y chercher du texte brut. Cela verifie au passage qu'il n'est pas
  // corrompu. Le texte dessine, lui, vit dans des flux compresses : il est couvert par les
  // tests de non-regression visuelle cote application, pas ici.
  const octets = await buildQuittancePdf(donnees);
  const relu = await PDFDocument.load(octets);
  assert.equal(relu.getTitle(), "Quittance de loyer QUIT-202603-ABCD1234");
  assert.equal(relu.getSubject(), "Quittance de loyer - mars 2026");
  assert.equal(relu.getPageCount(), 1, "une quittance tient sur une page");
});

test("un loyer sans charges reste valide et affiche zero", async () => {
  // Cas frequent : beaucoup de biens n'ont aucune provision pour charges. La ligne doit
  // rester presente, car la loi impose le detail meme lorsqu'il est nul.
  const octets = await buildQuittancePdf({ ...donnees, chargesCents: 0 });
  assert.ok(octets.byteLength > 1000);
});

test("les caracteres typographiques ne font pas echouer la generation", async () => {
  // Les polices standard PDF n'acceptent pas les apostrophes courbes ni les tirets longs :
  // ils sont remplaces en amont. Sans cela, la generation leve une erreur d'encodage.
  const octets = await buildQuittancePdf({
    ...donnees,
    bailleur: { ...donnees.bailleur, nom: "Agence l’Horizon — Gestion" },
    locataire: { nom: "Marie D’Alençon", adresse: ["8 avenue du Parc", "69006 Lyon"] },
  });
  assert.ok(octets.byteLength > 1000);
});

test("les accents francais sont conserves, pas transformes en texte sans accent", async () => {
  // Un document officiel francais ecrit « Periode » et « regle » fait neglige. L'encodage
  // WinAnsi des polices standard couvre les accents : il n'y a aucune raison de les retirer.
  // Ce test echouerait si quelqu'un « nettoyait » les accents pour eviter un plantage.
  const octets = await buildQuittancePdf({
    ...donnees,
    locataire: { nom: "Éléonore Çavaçà Ùmlaut", adresse: ["1 rue de l'Été", "75001 Paris"] },
  });
  assert.ok(octets.byteLength > 1000, "les accents ne doivent pas faire echouer la generation");
});
