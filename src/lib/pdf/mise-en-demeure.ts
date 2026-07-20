import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  assainir,
  BLANC,
  BLEU,
  BLEU_PALE,
  CONTENU,
  ENCRE,
  formaterEuros,
  formaterEurosTexte,
  GRIS,
  HAUTEUR,
  LARGEUR,
  LIGNE,
  MARGE,
  outilsDePage,
  ROUGE,
  ROUGE_PALE,
} from "./mise-en-page.ts";
import type { EcheanceImpayee, PartieCourrier } from "./relance-loyer.ts";
import { duMois } from "./relance-loyer.ts";

/**
 * Mise en demeure de payer un loyer impayé.
 *
 * ⚠️ PORTÉE JURIDIQUE — à ne pas surestimer :
 *  - une mise en demeure envoyée par simple e-mail a une valeur probatoire faible. Ce
 *    document est fait pour être IMPRIMÉ et envoyé en lettre recommandée avec accusé de
 *    réception, seule forme qui établit la date de réception ;
 *  - si le bail comporte une clause résolutoire, l'acte qui ouvre le délai légal de deux
 *    mois est un COMMANDEMENT DE PAYER délivré par un commissaire de justice, pas cette
 *    lettre. La lettre reste utile : elle constitue la mise en demeure préalable, fait
 *    courir les intérêts de retard et démontre la diligence du bailleur.
 *
 * Le courrier le rappelle explicitement, pour que personne ne croie qu'un e-mail suffit.
 *
 * Rédigé sans conseil juridique professionnel : à faire relire une fois par un avocat ou un
 * commissaire de justice avant usage réel.
 */

export type MiseEnDemeureData = {
  reference: string;
  bailleur: PartieCourrier & { siren?: string | null };
  locataire: PartieCourrier;
  logement: string[];
  echeances: EcheanceImpayee[];
  /** Dates des relances déjà adressées, rappelées comme preuve de diligence. */
  relancesLe: string[];
  delaiJours: number;
  lieuEtDate: string;
};

export function objetMiseEnDemeure(periodeLabel: string) {
  return `MISE EN DEMEURE — loyer ${duMois(periodeLabel)} impayé`;
}

export async function buildMiseEnDemeurePdf(data: MiseEnDemeureData): Promise<Uint8Array> {
  const total = data.echeances.reduce((somme, echeance) => somme + echeance.montantCents, 0);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`MISE EN DEMEURE ${data.reference}`);
  pdf.setSubject(objetMiseEnDemeure(data.echeances[0]?.periodeLabel ?? ""));
  pdf.setProducer("GERIMMO");

  const page = pdf.addPage([LARGEUR, HAUTEUR]);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grasse = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { texte, largeurTexte } = outilsDePage(page, normale, grasse);

  // ── Bandeau rouge : ce courrier ne doit pas se confondre avec une relance ─────────
  const hauteurBandeau = 74;
  page.drawRectangle({ x: 0, y: HAUTEUR - hauteurBandeau, width: LARGEUR, height: hauteurBandeau, color: ROUGE });
  texte("LOGEMENT CONCERNÉ", MARGE, HAUTEUR - 27, { taille: 7, gras: true, couleur: ROUGE_PALE });
  let ligneEnTete = HAUTEUR - 44;
  for (const ligne of data.logement.slice(0, 2)) {
    texte(ligne, MARGE, ligneEnTete, { taille: 12.5, gras: true, couleur: BLANC });
    ligneEnTete -= 16;
  }
  const titre = "MISE EN DEMEURE";
  texte(titre, LARGEUR - MARGE - largeurTexte(titre, 13.5, true), HAUTEUR - 34, {
    taille: 13.5,
    gras: true,
    couleur: BLANC,
  });
  const ref = `Réf. ${data.reference}`;
  texte(ref, LARGEUR - MARGE - largeurTexte(ref, 8), HAUTEUR - 50, { taille: 8, couleur: ROUGE_PALE });

  let y = HAUTEUR - hauteurBandeau - 26;

  // Mode d'acheminement : c'est lui qui donne sa force au courrier.
  const mention = "LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION";
  texte(mention, MARGE, y, { taille: 8.5, gras: true, couleur: ROUGE });
  y -= 26;

  // ── Les deux parties ──────────────────────────────────────────────────────────────
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
  y -= hauteurBloc + 22;

  texte(data.lieuEtDate, LARGEUR - MARGE - largeurTexte(data.lieuEtDate, 10), y, { taille: 10 });
  y -= 24;

  const objet = objetMiseEnDemeure(data.echeances[0]?.periodeLabel ?? "");
  texte(`Objet : ${objet}`, MARGE, y, { taille: 10.5, gras: true });
  y -= 24;

  const paragraphe = (contenu: string, taille = 10, couleur = ENCRE, gras = false) => {
    const mots = assainir(contenu).split(" ");
    let ligne = "";
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if ((gras ? grasse : normale).widthOfTextAtSize(essai, taille) > CONTENU) {
        texte(ligne, MARGE, y, { taille, couleur, gras });
        y -= taille + 4.5;
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    if (ligne) {
      texte(ligne, MARGE, y, { taille, couleur, gras });
      y -= taille + 4.5;
    }
  };

  paragraphe(`${data.locataire.nom},`);
  y -= 6;

  const rappelRelances =
    data.relancesLe.length > 0
      ? `Malgré nos rappels des ${data.relancesLe.join(" et ")}, restés sans effet, `
      : "Malgré nos rappels restés sans effet, ";
  paragraphe(
    `${rappelRelances}les loyers et charges du logement désigné ci-dessus demeurent impayés à ce jour, ` +
      `pour un montant total de ${formaterEurosTexte(total)}.`,
  );
  y -= 12;

  // ── Sommes dues ───────────────────────────────────────────────────────────────────
  const colonneMontant = LARGEUR - MARGE - 12;
  const hauteurLigne = 22;
  page.drawRectangle({ x: MARGE, y: y - 19, width: CONTENU, height: 19, color: BLEU });
  texte("PÉRIODE", MARGE + 12, y - 13, { taille: 8, gras: true, couleur: BLANC });
  texte("ÉCHÉANCE", MARGE + 200, y - 13, { taille: 8, gras: true, couleur: BLANC });
  const enTeteMontant = "MONTANT DÛ";
  texte(enTeteMontant, colonneMontant - largeurTexte(enTeteMontant, 8, true), y - 13, {
    taille: 8,
    gras: true,
    couleur: BLANC,
  });
  y -= 19;

  for (const echeance of data.echeances) {
    page.drawLine({
      start: { x: MARGE, y: y - hauteurLigne },
      end: { x: LARGEUR - MARGE, y: y - hauteurLigne },
      thickness: 0.5,
      color: LIGNE,
    });
    texte(echeance.periodeLabel, MARGE + 12, y - 15, { taille: 9.5 });
    texte(echeance.echeanceLe, MARGE + 200, y - 15, { taille: 9.5, couleur: GRIS });
    const valeur = formaterEuros(echeance.montantCents);
    texte(valeur, colonneMontant - largeurTexte(valeur, 9.5), y - 15, { taille: 9.5 });
    y -= hauteurLigne;
  }
  page.drawRectangle({ x: MARGE, y: y - hauteurLigne, width: CONTENU, height: hauteurLigne, color: ROUGE_PALE });
  texte("Total dû", MARGE + 12, y - 15, { taille: 11, gras: true });
  const valeurTotale = formaterEuros(total);
  texte(valeurTotale, colonneMontant - largeurTexte(valeurTotale, 11, true), y - 15, { taille: 11, gras: true });
  y -= hauteurLigne + 22;

  // ── L'injonction proprement dite ──────────────────────────────────────────────────
  paragraphe(
    `En conséquence, nous vous METTONS EN DEMEURE de régler la somme de ${formaterEurosTexte(total)} ` +
      `dans un délai de ${data.delaiJours} jours à compter de la réception de la présente.`,
    10.5,
    ENCRE,
    true,
  );
  y -= 8;
  paragraphe(
    "À défaut de règlement dans ce délai, le bailleur se réserve le droit d'engager toute procédure utile, " +
      "notamment de faire délivrer un commandement de payer par commissaire de justice et de saisir le juge " +
      "des contentieux de la protection aux fins de résiliation du bail et d'expulsion, ainsi que de mettre " +
      "en jeu la garantie ou le cautionnement le cas échéant.",
  );
  y -= 8;
  paragraphe(
    "La présente vaut mise en demeure au sens de l'article 1344 du code civil et fait courir les intérêts " +
      "de retard.",
  );
  y -= 8;
  paragraphe(
    "Si votre règlement a été effectué entre-temps, nous vous prions de ne pas tenir compte du présent " +
      "courrier et de nous en informer sans délai.",
    9.5,
    GRIS,
  );
  y -= 20;

  // ── Signature ─────────────────────────────────────────────────────────────────────
  const largeurSignature = 240;
  const hauteurSignature = 74;
  const xSignature = LARGEUR - MARGE - largeurSignature;
  page.drawRectangle({
    x: xSignature,
    y: y - hauteurSignature,
    width: largeurSignature,
    height: hauteurSignature,
    borderColor: LIGNE,
    borderWidth: 0.5,
  });
  texte("Le bailleur ou son mandataire", xSignature + 10, y - 15, { taille: 8, couleur: GRIS });

  // ── Pied de page ──────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: MARGE, y: 58 }, end: { x: LARGEUR - MARGE, y: 58 }, thickness: 0.5, color: LIGNE });
  const piedGauche = [data.bailleur.nom, data.bailleur.siren ? `SIREN ${data.bailleur.siren}` : null]
    .filter(Boolean)
    .join(" · ");
  texte(piedGauche, MARGE, 44, { taille: 7.5, couleur: GRIS });
  const piedDroite = `MISE EN DEMEURE ${data.reference}`;
  texte(piedDroite, LARGEUR - MARGE - largeurTexte(piedDroite, 7.5), 44, { taille: 7.5, couleur: GRIS });

  return pdf.save();
}
