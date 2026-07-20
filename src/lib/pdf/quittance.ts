import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Quittance de loyer au format PDF.
 *
 * Mentions imposées par l'article 21 de la loi n° 89-462 du 6 juillet 1989 :
 *  - le détail du loyer ET des charges, SÉPARÉMENT (un montant global rend la quittance
 *    irrégulière) ;
 *  - la période exacte couverte ;
 *  - l'identité du bailleur et du locataire ;
 *  - la remise gratuite ;
 *  - la mention annulant les reçus antérieurs en cas de paiement partiel.
 *
 * Logique volontairement PURE : elle ne lit rien en base et ne dépend d'aucun client. Elle
 * reçoit des données déjà mises en forme et rend un PDF, ce qui la rend testable.
 */

export type PartieQuittance = {
  nom: string;
  /** Lignes d'adresse déjà ordonnées, sans lignes vides. */
  adresse: string[];
};

export type QuittanceData = {
  reference: string;
  bailleur: PartieQuittance & { siren?: string | null };
  locataire: PartieQuittance;
  /** Adresse du logement loué. */
  logement: string[];
  /** Ex. « mars 2026 ». */
  periodeLabel: string;
  periodeDebut: string;
  periodeFin: string;
  loyerCents: number;
  chargesCents: number;
  dateReglement: string;
  /** Ex. « Fait à Lyon, le 20/07/2026 ». */
  lieuEtDate: string;
};

const MARGE = 56;
const LARGEUR = 595.28; // A4 en points
const HAUTEUR = 841.89;

/** WinAnsi (police standard PDF) ne couvre pas les apostrophes et tirets typographiques. */
function assainir(texte: string) {
  return texte.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/ /g, " ");
}

export function formaterEuros(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;
}

export async function buildQuittancePdf(data: QuittanceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Quittance de loyer ${data.reference}`);
  pdf.setSubject(`Quittance de loyer - ${data.periodeLabel}`);
  pdf.setProducer("GERIMMO");

  const page = pdf.addPage([LARGEUR, HAUTEUR]);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grasse = await pdf.embedFont(StandardFonts.HelveticaBold);
  const noir = rgb(0.09, 0.11, 0.15);
  const gris = rgb(0.42, 0.45, 0.5);

  let y = HAUTEUR - MARGE;

  const ecrire = (
    texte: string,
    options: { taille?: number; gras?: boolean; couleur?: typeof noir; x?: number; interligne?: number } = {},
  ) => {
    const taille = options.taille ?? 10.5;
    page.drawText(assainir(texte), {
      x: options.x ?? MARGE,
      y,
      size: taille,
      font: options.gras ? grasse : normale,
      color: options.couleur ?? noir,
    });
    y -= options.interligne ?? taille + 4;
  };

  const saut = (hauteur: number) => {
    y -= hauteur;
  };

  // En-tête : le bailleur (auteur du document) en haut à gauche.
  ecrire(data.bailleur.nom, { gras: true, taille: 12 });
  for (const ligne of data.bailleur.adresse) ecrire(ligne, { taille: 9.5, couleur: gris });
  if (data.bailleur.siren) ecrire(`SIREN ${data.bailleur.siren}`, { taille: 9.5, couleur: gris });

  // Le locataire, destinataire, décalé à droite comme sur un courrier.
  const yBailleur = y;
  y = HAUTEUR - MARGE - 24;
  const colonneDroite = LARGEUR / 2 + 20;
  ecrire(data.locataire.nom, { gras: true, taille: 11, x: colonneDroite });
  for (const ligne of data.locataire.adresse) ecrire(ligne, { taille: 9.5, x: colonneDroite, couleur: gris });
  y = Math.min(yBailleur, y);

  saut(30);
  ecrire("QUITTANCE DE LOYER", { gras: true, taille: 17 });
  ecrire(`Reference ${data.reference}`, { taille: 9.5, couleur: gris });
  saut(14);

  ecrire(`Periode : ${data.periodeLabel} (du ${data.periodeDebut} au ${data.periodeFin})`, { gras: true });
  saut(6);
  ecrire("Logement loue :", { gras: true, taille: 10 });
  for (const ligne of data.logement) ecrire(ligne, { taille: 10 });
  saut(16);

  // Le détail chiffré : loyer et charges séparés, comme l'exige la loi.
  const total = data.loyerCents + data.chargesCents;
  const colonneMontant = LARGEUR - MARGE - 110;
  const ligneMontant = (libelle: string, montant: number, gras = false) => {
    page.drawText(assainir(libelle), { x: MARGE, y, size: 10.5, font: gras ? grasse : normale, color: noir });
    page.drawText(formaterEuros(montant), {
      x: colonneMontant,
      y,
      size: 10.5,
      font: gras ? grasse : normale,
      color: noir,
    });
    y -= 17;
  };

  ligneMontant("Loyer hors charges", data.loyerCents);
  ligneMontant("Provision pour charges", data.chargesCents);
  page.drawLine({
    start: { x: MARGE, y: y + 6 },
    end: { x: LARGEUR - MARGE, y: y + 6 },
    thickness: 0.6,
    color: gris,
  });
  y -= 6;
  ligneMontant("Total regle", total, true);
  saut(14);

  // Formule de quittance proprement dite.
  const paragraphe = (texte: string, taille = 10.5) => {
    const mots = assainir(texte).split(" ");
    const largeurMax = LARGEUR - MARGE * 2;
    let ligne = "";
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (normale.widthOfTextAtSize(essai, taille) > largeurMax) {
        ecrire(ligne, { taille, interligne: taille + 5 });
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    if (ligne) ecrire(ligne, { taille, interligne: taille + 5 });
  };

  paragraphe(
    `Je soussigne ${data.bailleur.nom}, bailleur ou mandataire du logement designe ci-dessus, ` +
      `declare avoir recu de ${data.locataire.nom} la somme de ${formaterEuros(total)} ` +
      `au titre du loyer et des charges de la periode indiquee, et lui en donne quittance, ` +
      `sous reserve de tous mes droits.`,
  );
  saut(6);
  paragraphe(`Reglement recu le ${data.dateReglement}.`);
  saut(10);
  paragraphe(
    "Cette quittance annule tous les recus qui auraient pu etre etablis precedemment en cas de " +
      "paiement partiel du montant du present terme. Elle est remise gratuitement au locataire, " +
      "conformement a l'article 21 de la loi n° 89-462 du 6 juillet 1989.",
    9,
  );

  saut(26);
  ecrire(data.lieuEtDate, { taille: 10.5 });
  saut(4);
  ecrire("Le bailleur ou son mandataire", { taille: 9.5, couleur: gris });

  page.drawText(assainir("Document genere par GERIMMO"), {
    x: MARGE,
    y: MARGE - 16,
    size: 8,
    font: normale,
    color: gris,
  });

  return pdf.save();
}
