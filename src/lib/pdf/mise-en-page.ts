import { type PDFFont, type PDFPage, rgb } from "pdf-lib";

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
