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

const MARGE = 52;
const LARGEUR = 595.28; // A4 en points
const HAUTEUR = 841.89;
const CONTENU = LARGEUR - MARGE * 2;

// Palette sobre : un document officiel doit inspirer confiance, pas attirer l'œil.
const ENCRE = rgb(0.11, 0.13, 0.18);
const GRIS = rgb(0.42, 0.45, 0.5);
const BLEU = rgb(0.14, 0.29, 0.49);
const BLEU_PALE = rgb(0.93, 0.95, 0.98);
const LIGNE = rgb(0.85, 0.87, 0.9);
const BLANC = rgb(1, 1, 1);

/**
 * Les polices standard PDF utilisent l'encodage WinAnsi : il couvre les accents français
 * (é, è, à, ç, ù) mais PAS les apostrophes et tirets typographiques, qui feraient échouer la
 * génération. Seuls ces derniers sont donc remplacés — les accents sont conservés, un
 * document officiel sans accents faisant négligé.
 */
export function assainirPourTest(texte: string) {
  return assainir(texte);
}

function assainir(texte: string) {
  return (
    texte
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      // Espaces insécables désignées par leur code : écrites littéralement, le formateur les
      // réunit en « [ {2}] », qui dans une classe de caractères signifie « espace, accolade,
      // CHIFFRE 2, accolade » — et efface donc tous les 2 du document.
      .replace(/[  ]/g, " ")
  );
}

export function formaterEuros(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} \u20AC`;
}

/**
 * Montant destiné à une phrase, et non à une colonne de chiffres.
 *
 * Le symbole « € » n'a pas de largeur déclarée dans les métriques des polices standard PDF :
 * placé au milieu d'un texte, il chevauche le mot suivant. Il reste donc réservé au tableau,
 * où il termine la ligne — et la prose écrit « euros », qui est de toute façon la formulation
 * d'usage sur un document officiel.
 */
export function formaterEurosTexte(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} euros`;
}

export async function buildQuittancePdf(data: QuittanceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Quittance de loyer ${data.reference}`);
  pdf.setSubject(`Quittance de loyer - ${data.periodeLabel}`);
  pdf.setProducer("GERIMMO");

  const page = pdf.addPage([LARGEUR, HAUTEUR]);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grasse = await pdf.embedFont(StandardFonts.HelveticaBold);

  const texte = (
    contenu: string,
    x: number,
    y: number,
    options: { taille?: number; gras?: boolean; couleur?: typeof ENCRE } = {},
  ) => {
    page.drawText(assainir(contenu), {
      x,
      y,
      size: options.taille ?? 10,
      font: options.gras ? grasse : normale,
      color: options.couleur ?? ENCRE,
    });
  };

  const largeurTexte = (contenu: string, taille: number, gras = false) =>
    (gras ? grasse : normale).widthOfTextAtSize(assainir(contenu), taille);

  // ── Bandeau d'en-tête : LE LOGEMENT ───────────────────────────────────────────────
  // C'est le logement qui identifie la quittance au premier coup d'œil, pas le bailleur.
  // Celui-ci reste identifié par la formule « Je soussigné… » et par le pied de page, ce qui
  // satisfait l'obligation de désigner l'auteur du document.
  const hauteurBandeau = 74;
  page.drawRectangle({ x: 0, y: HAUTEUR - hauteurBandeau, width: LARGEUR, height: hauteurBandeau, color: BLEU });
  texte("LOGEMENT LOUÉ", MARGE, HAUTEUR - 27, { taille: 7, gras: true, couleur: BLEU_PALE });
  let ligneEnTete = HAUTEUR - 44;
  for (const ligne of data.logement.slice(0, 2)) {
    texte(ligne, MARGE, ligneEnTete, { taille: 12.5, gras: true, couleur: BLANC });
    ligneEnTete -= 16;
  }

  const titre = "QUITTANCE DE LOYER";
  texte(titre, LARGEUR - MARGE - largeurTexte(titre, 12.5, true), HAUTEUR - 34, {
    taille: 12.5,
    gras: true,
    couleur: BLANC,
  });
  const ref = `Réf. ${data.reference}`;
  texte(ref, LARGEUR - MARGE - largeurTexte(ref, 8), HAUTEUR - 50, { taille: 8, couleur: BLEU_PALE });

  let y = HAUTEUR - hauteurBandeau - 34;

  // ── Les deux parties, côte à côte ─────────────────────────────────────────────────
  // Le bailleur peut figurer ici sans faire doublon : le bandeau porte désormais le
  // logement, pas lui.
  const largeurBloc = (CONTENU - 18) / 2;
  const hauteurBloc = 78;
  const bloc = (x: number, intitule: string, nom: string, lignes: string[]) => {
    page.drawRectangle({
      x,
      y: y - hauteurBloc,
      width: largeurBloc,
      height: hauteurBloc,
      color: BLEU_PALE,
      borderColor: LIGNE,
      borderWidth: 0.5,
    });
    texte(intitule, x + 12, y - 20, { taille: 7.5, gras: true, couleur: BLEU });
    texte(nom, x + 12, y - 38, { taille: 11, gras: true });
    let ligneBloc = y - 54;
    for (const ligne of lignes.slice(0, 2)) {
      texte(ligne, x + 12, ligneBloc, { taille: 9.5, couleur: GRIS });
      ligneBloc -= 13;
    }
  };

  const identiteBailleur = [...data.bailleur.adresse];
  if (data.bailleur.siren) identiteBailleur.push(`SIREN ${data.bailleur.siren}`);
  bloc(MARGE, "BAILLEUR OU MANDATAIRE", data.bailleur.nom, identiteBailleur);
  bloc(MARGE + largeurBloc + 18, "LOCATAIRE", data.locataire.nom, data.locataire.adresse);
  y -= hauteurBloc + 26;

  // ── Période quittancée ────────────────────────────────────────────────────────────
  // Le logement n'est plus repris ici : il occupe le bandeau d'en-tête.
  const hauteurEnjeu = 52;
  page.drawRectangle({
    x: MARGE,
    y: y - hauteurEnjeu,
    width: CONTENU,
    height: hauteurEnjeu,
    borderColor: BLEU,
    borderWidth: 1,
  });
  texte("PÉRIODE QUITTANCÉE", MARGE + 14, y - 20, { taille: 7.5, gras: true, couleur: BLEU });
  texte(`${data.periodeLabel} — du ${data.periodeDebut} au ${data.periodeFin}`, MARGE + 14, y - 40, {
    taille: 13,
    gras: true,
  });
  y -= hauteurEnjeu + 24;

  const total = data.loyerCents + data.chargesCents;

  // ── Formule de quittance, AVANT le détail chiffré ─────────────────────────────────
  // Elle énonce l'engagement ; le tableau qui suit ne fait que le détailler.
  const paragraphe = (contenu: string, taille = 10, couleur = ENCRE) => {
    const mots = assainir(contenu).split(" ");
    let ligne = "";
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (normale.widthOfTextAtSize(essai, taille) > CONTENU) {
        texte(ligne, MARGE, y, { taille, couleur });
        y -= taille + 5;
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    if (ligne) {
      texte(ligne, MARGE, y, { taille, couleur });
      y -= taille + 5;
    }
  };

  paragraphe(
    `Je soussigné ${data.bailleur.nom}, bailleur ou mandataire du logement désigné ci-dessus, ` +
      `déclare avoir reçu de ${data.locataire.nom} la somme de ${formaterEurosTexte(total)} ` +
      `au titre du loyer et des charges de la période indiquée, et lui en donne quittance, ` +
      `sous réserve de tous mes droits.`,
  );
  y -= 20;

  // ── Détail chiffré : loyer et charges séparés, comme l'exige la loi ───────────────
  const colonneMontant = LARGEUR - MARGE - 12;
  const hauteurLigne = 26;

  page.drawRectangle({ x: MARGE, y: y - 20, width: CONTENU, height: 20, color: BLEU });
  texte("DÉSIGNATION", MARGE + 12, y - 14, { taille: 8, gras: true, couleur: BLANC });
  const enTeteMontant = "MONTANT";
  texte(enTeteMontant, colonneMontant - largeurTexte(enTeteMontant, 8, true), y - 14, {
    taille: 8,
    gras: true,
    couleur: BLANC,
  });
  y -= 20;

  const ligneMontant = (libelle: string, montant: number, options: { fond?: boolean; gras?: boolean } = {}) => {
    if (options.fond) {
      page.drawRectangle({ x: MARGE, y: y - hauteurLigne, width: CONTENU, height: hauteurLigne, color: BLEU_PALE });
    }
    page.drawLine({
      start: { x: MARGE, y: y - hauteurLigne },
      end: { x: LARGEUR - MARGE, y: y - hauteurLigne },
      thickness: 0.5,
      color: LIGNE,
    });
    const taille = options.gras ? 11 : 10;
    texte(libelle, MARGE + 12, y - 17, { taille, gras: options.gras });
    const valeur = formaterEuros(montant);
    texte(valeur, colonneMontant - largeurTexte(valeur, taille, options.gras), y - 17, {
      taille,
      gras: options.gras,
    });
    y -= hauteurLigne;
  };

  ligneMontant("Loyer hors charges", data.loyerCents);
  ligneMontant("Provision pour charges", data.chargesCents);
  ligneMontant("Total réglé", total, { fond: true, gras: true });
  y -= 12;
  texte(`Règlement reçu le ${data.dateReglement}.`, MARGE, y, { taille: 9.5, couleur: GRIS });
  // Les mentions légales sont un propos distinct : elles ont besoin de respirer, sinon
  // elles se lisent comme la suite de la ligne de règlement.
  y -= 42;

  // Mentions légales, dans un encadré discret.
  const hauteurMentions = 56;
  page.drawRectangle({
    x: MARGE,
    y: y - hauteurMentions,
    width: CONTENU,
    height: hauteurMentions,
    color: BLEU_PALE,
    borderColor: LIGNE,
    borderWidth: 0.5,
  });
  const yMentions = y;
  y -= 18;
  paragraphe(
    "Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de " +
      "paiement partiel du montant du présent terme. Elle est remise gratuitement au locataire, " +
      "conformément à l'article 21 de la loi n° 89-462 du 6 juillet 1989.",
    8.5,
    GRIS,
  );
  y = yMentions - hauteurMentions - 30;

  // ── Signature ─────────────────────────────────────────────────────────────────────
  // Un cadre explicite plutôt qu'un grand vide : le document est souvent imprimé, signé à la
  // main puis scanné. L'emplacement doit se voir.
  const largeurSignature = 240;
  const hauteurSignature = 86;
  const xSignature = LARGEUR - MARGE - largeurSignature;
  texte(data.lieuEtDate, xSignature, y, { taille: 10 });
  y -= 12;
  page.drawRectangle({
    x: xSignature,
    y: y - hauteurSignature,
    width: largeurSignature,
    height: hauteurSignature,
    borderColor: LIGNE,
    borderWidth: 0.5,
  });
  texte("Signature du bailleur ou de son mandataire", xSignature + 10, y - 16, { taille: 8, couleur: GRIS });

  // ── Pied de page ──────────────────────────────────────────────────────────────────
  // Aucune mention de GERIMMO : l'agence présente ce document comme le sien. Seule son
  // identité et la référence de la quittance y figurent.
  page.drawLine({
    start: { x: MARGE, y: 58 },
    end: { x: LARGEUR - MARGE, y: 58 },
    thickness: 0.5,
    color: LIGNE,
  });
  const piedGauche = [data.bailleur.nom, data.bailleur.siren ? `SIREN ${data.bailleur.siren}` : null]
    .filter(Boolean)
    .join(" · ");
  texte(piedGauche, MARGE, 44, { taille: 7.5, couleur: GRIS });
  const piedDroite = `Quittance ${data.reference}`;
  texte(piedDroite, LARGEUR - MARGE - largeurTexte(piedDroite, 7.5), 44, { taille: 7.5, couleur: GRIS });

  return pdf.save();
}
