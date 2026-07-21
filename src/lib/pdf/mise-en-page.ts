import { type PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";

/**
 * Fondations communes aux documents officiels (quittance, relances, mise en demeure).
 *
 * Ces courriers partent au même destinataire, à quelques semaines d'intervalle : ils doivent
 * se ressembler. Palette, marges et helpers de texte sont donc définis ici une seule fois.
 */

export const MARGE = 52;
export const LARGEUR = 595.28; // A4 en points
export const HAUTEUR = 841.89;
export const CONTENU = LARGEUR - MARGE * 2;

// Palette sobre : un document officiel doit inspirer confiance, pas attirer l'œil.
export const ENCRE = rgb(0.11, 0.13, 0.18);
export const GRIS = rgb(0.42, 0.45, 0.5);
export const BLEU = rgb(0.14, 0.29, 0.49);
export const BLEU_PALE = rgb(0.93, 0.95, 0.98);
export const LIGNE = rgb(0.85, 0.87, 0.9);
export const BLANC = rgb(1, 1, 1);
// Réservé aux courriers de recouvrement : la mise en demeure doit se distinguer d'un rappel.
export const ROUGE = rgb(0.63, 0.15, 0.15);
export const ROUGE_PALE = rgb(0.99, 0.93, 0.93);

/**
 * Les polices standard PDF utilisent l'encodage WinAnsi : il couvre les accents français
 * (é, è, à, ç, ù) mais PAS les apostrophes et tirets typographiques, qui feraient échouer la
 * génération. Seuls ces derniers sont remplacés — un document officiel sans accents fait
 * négligé.
 *
 * ⚠️ Les espaces insécables sont désignées par leur code : écrites littéralement, le
 * formateur les réunit en « [ {2}] », qui dans une classe de caractères signifie « espace,
 * accolade, CHIFFRE 2, accolade » — et efface donc tous les 2 du document.
 */
export function assainir(texte: string) {
  return texte.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[  ]/g, " ");
}

export function formaterEuros(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

/**
 * Montant destiné à une phrase, et non à une colonne de chiffres.
 *
 * Le symbole « € » n'a pas de largeur déclarée dans les métriques des polices standard PDF :
 * placé au milieu d'un texte, il chevauche le mot suivant. Il reste donc réservé aux
 * tableaux, où il termine la ligne — et la prose écrit « euros », qui est de toute façon la
 * formulation d'usage sur un document officiel.
 */
export function formaterEurosTexte(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} euros`;
}

export type OptionsTexte = {
  taille?: number;
  gras?: boolean;
  couleur?: ReturnType<typeof rgb>;
};

/** Outils d'écriture liés à une page : évitent de repasser police et couleurs partout. */
export function outilsDePage(page: PDFPage, normale: PDFFont, grasse: PDFFont) {
  const texte = (contenu: string, x: number, y: number, options: OptionsTexte = {}) => {
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

  return { texte, largeurTexte };
}

export type EnteteOptions = {
  /** Couleur du bandeau : bleu pour quittance/relances, rouge pour la mise en demeure. */
  couleur: ReturnType<typeof rgb>;
  couleurPale: ReturnType<typeof rgb>;
  /** Petit intitulé au-dessus des lignes de gauche, ex. « LOGEMENT LOUÉ ». */
  intitule: string;
  /** Jusqu'à 2 lignes à gauche (typiquement l'adresse du logement). */
  lignes: string[];
  titre: string;
  reference: string;
  tailleTitre?: number;
  /** Logo de l'organisation (PNG ou JPEG). Placé sur une pastille blanche, à gauche. */
  logo?: Uint8Array | null;
};

/**
 * Dessine le bandeau d'en-tête commun aux documents.
 *
 * Le logo, quand il existe, est posé sur une pastille blanche — un logo peut être sombre et
 * deviendrait illisible directement sur le bandeau coloré. Le reste du contenu se décale à sa
 * droite. Sans logo, la mise en page est identique à avant.
 */
export async function dessinerEntete(
  pdf: PDFDocument,
  page: PDFPage,
  outils: ReturnType<typeof outilsDePage>,
  options: EnteteOptions,
) {
  const { texte, largeurTexte } = outils;
  const hauteurBandeau = 74;
  page.drawRectangle({
    x: 0,
    y: HAUTEUR - hauteurBandeau,
    width: LARGEUR,
    height: hauteurBandeau,
    color: options.couleur,
  });

  let xGauche = MARGE;
  if (options.logo && options.logo.byteLength > 0) {
    try {
      const estPng = options.logo[0] === 0x89 && options.logo[1] === 0x50;
      const image = estPng ? await pdf.embedPng(options.logo) : await pdf.embedJpg(options.logo);
      const cote = 46;
      const echelle = image.scale(Math.min(cote / image.width, cote / image.height));
      const chipY = HAUTEUR - hauteurBandeau + (hauteurBandeau - cote) / 2;
      page.drawRectangle({ x: MARGE, y: chipY, width: cote, height: cote, color: BLANC });
      page.drawImage(image, {
        x: MARGE + (cote - echelle.width) / 2,
        y: chipY + (cote - echelle.height) / 2,
        width: echelle.width,
        height: echelle.height,
      });
      xGauche = MARGE + cote + 14;
    } catch {
      // Logo illisible (format inattendu) : on ignore et on garde l'en-tête texte.
    }
  }

  texte(options.intitule, xGauche, HAUTEUR - 27, { taille: 7, gras: true, couleur: options.couleurPale });
  let ligneY = HAUTEUR - 44;
  for (const ligne of options.lignes.slice(0, 2)) {
    texte(ligne, xGauche, ligneY, { taille: 12.5, gras: true, couleur: BLANC });
    ligneY -= 16;
  }

  const tailleTitre = options.tailleTitre ?? 12.5;
  texte(options.titre, LARGEUR - MARGE - largeurTexte(options.titre, tailleTitre, true), HAUTEUR - 34, {
    taille: tailleTitre,
    gras: true,
    couleur: BLANC,
  });
  const ref = `Réf. ${options.reference}`;
  texte(ref, LARGEUR - MARGE - largeurTexte(ref, 8), HAUTEUR - 50, { taille: 8, couleur: options.couleurPale });

  return { y: HAUTEUR - hauteurBandeau };
}
