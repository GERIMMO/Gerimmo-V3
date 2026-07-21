import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  assainir,
  BLANC,
  BLEU,
  BLEU_PALE,
  CONTENU,
  dessinerCadreSignature,
  dessinerEntete,
  ENCRE,
  formaterEuros,
  formaterEurosTexte,
  GRIS,
  HAUTEUR,
  LARGEUR,
  LIGNE,
  MARGE,
  outilsDePage,
} from "./mise-en-page.ts";

/**
 * Lettre de relance pour loyer impayé — premier ou second rappel.
 *
 * Les deux niveaux sont volontairement distincts : un locataire qui reçoit deux fois le même
 * courrier ne perçoit aucune escalade, et le bailleur ne peut pas démontrer qu'il a relancé
 * à deux reprises avant la mise en demeure. Le niveau figure donc dans le titre, dans la
 * référence et dans le ton du texte.
 *
 * ⚠️ Une relance n'a pas de valeur juridique contraignante : c'est un rappel amiable. La
 * mise en demeure, elle, est un acte distinct (voir mise-en-demeure).
 *
 * Logique volontairement PURE : données en entrée, PDF en sortie.
 */

export type PartieCourrier = {
  nom: string;
  adresse: string[];
};

export type EcheanceImpayee = {
  /** Ex. « avril 2026 ». */
  periodeLabel: string;
  /** Date d'exigibilité, ex. « 05/04/2026 ». */
  echeanceLe: string;
  montantCents: number;
};

export type RelanceData = {
  /** 1 = rappel courtois, 2 = relance ferme annonçant la mise en demeure. */
  niveau: 1 | 2;
  reference: string;
  bailleur: PartieCourrier & { siren?: string | null };
  locataire: PartieCourrier;
  logement: string[];
  echeances: EcheanceImpayee[];
  /** Date de la première relance, rappelée dans la seconde. */
  relancePrecedenteLe?: string | null;
  /** Délai laissé au locataire pour régulariser, en jours. */
  delaiJours: number;
  lieuEtDate: string;
  logo?: Uint8Array | null;
  signature?: Uint8Array | null;
};

/**
 * « loyer d'avril » et non « loyer de avril » : avril, août et octobre commencent par une
 * voyelle. Sans cette élision, le courrier trahit immédiatement une génération automatique.
 */
export function duMois(periodeLabel: string) {
  return /^[aeiouyéèêAEIOUY]/.test(periodeLabel) ? `d'${periodeLabel}` : `de ${periodeLabel}`;
}

export function objetRelance(niveau: 1 | 2, periodeLabel: string) {
  return niveau === 1
    ? `Rappel — loyer ${duMois(periodeLabel)} non réglé`
    : `Seconde relance — loyer ${duMois(periodeLabel)} toujours impayé`;
}

export async function buildRelancePdf(data: RelanceData): Promise<Uint8Array> {
  const titre = data.niveau === 1 ? "PREMIÈRE RELANCE" : "SECONDE RELANCE";
  const total = data.echeances.reduce((somme, echeance) => somme + echeance.montantCents, 0);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${titre} ${data.reference}`);
  pdf.setSubject(objetRelance(data.niveau, data.echeances[0]?.periodeLabel ?? ""));
  pdf.setProducer("GERIMMO");

  const page = pdf.addPage([LARGEUR, HAUTEUR]);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grasse = await pdf.embedFont(StandardFonts.HelveticaBold);
  const outils = outilsDePage(page, normale, grasse);
  const { texte, largeurTexte } = outils;

  await dessinerEntete(pdf, page, outils, {
    couleur: BLEU,
    couleurPale: BLEU_PALE,
    intitule: "LOGEMENT CONCERNÉ",
    lignes: data.logement,
    titre,
    reference: data.reference,
    logo: data.logo,
  });

  let y = HAUTEUR - 74 - 34;

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
  y -= hauteurBloc + 24;

  texte(data.lieuEtDate, LARGEUR - MARGE - largeurTexte(data.lieuEtDate, 10), y, { taille: 10 });
  y -= 26;

  const objet = objetRelance(data.niveau, data.echeances[0]?.periodeLabel ?? "");
  texte(`Objet : ${objet}`, MARGE, y, { taille: 10.5, gras: true });
  y -= 26;

  const paragraphe = (contenu: string, taille = 10, couleur = ENCRE, gras = false) => {
    const mots = assainir(contenu).split(" ");
    let ligne = "";
    for (const mot of mots) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if ((gras ? grasse : normale).widthOfTextAtSize(essai, taille) > CONTENU) {
        texte(ligne, MARGE, y, { taille, couleur, gras });
        y -= taille + 5;
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    if (ligne) {
      texte(ligne, MARGE, y, { taille, couleur, gras });
      y -= taille + 5;
    }
  };

  paragraphe(`${data.locataire.nom},`);
  y -= 8;

  // ── Corps du courrier, différent selon le niveau ──────────────────────────────────
  if (data.niveau === 1) {
    paragraphe(
      `Sauf erreur de notre part, le loyer du logement désigné ci-dessus n'a pas été réglé à ce jour. ` +
        `Les sommes restant dues s'élèvent à ${formaterEurosTexte(total)}, selon le détail ci-après.`,
    );
    y -= 6;
    paragraphe(
      `Nous vous invitons à régulariser cette situation dans un délai de ${data.delaiJours} jours à compter ` +
        `de la réception du présent courrier.`,
    );
    y -= 6;
    paragraphe(
      "Si votre règlement a été effectué entre-temps, nous vous prions de ne pas tenir compte de ce rappel " +
        "et vous remercions de nous en informer.",
      10,
      GRIS,
    );
  } else {
    paragraphe(
      data.relancePrecedenteLe
        ? `Malgré notre premier rappel du ${data.relancePrecedenteLe}, le loyer du logement désigné ci-dessus ` +
            `demeure impayé à ce jour.`
        : `Malgré un premier rappel, le loyer du logement désigné ci-dessus demeure impayé à ce jour.`,
    );
    y -= 6;
    paragraphe(
      `Les sommes restant dues s'élèvent à ${formaterEurosTexte(total)}, selon le détail ci-après. ` +
        `Nous vous demandons de les régler sous ${data.delaiJours} jours à compter de la réception de ce courrier.`,
    );
    y -= 6;
    paragraphe(
      "À défaut de règlement dans ce délai, une mise en demeure vous sera adressée par lettre recommandée " +
        "avec accusé de réception, préalable aux poursuites que le bailleur serait fondé à engager.",
      10,
      ENCRE,
      true,
    );
  }
  y -= 18;

  // ── Détail des sommes dues ────────────────────────────────────────────────────────
  const colonneMontant = LARGEUR - MARGE - 12;
  const hauteurLigne = 24;

  page.drawRectangle({ x: MARGE, y: y - 20, width: CONTENU, height: 20, color: BLEU });
  texte("PÉRIODE", MARGE + 12, y - 14, { taille: 8, gras: true, couleur: BLANC });
  texte("ÉCHÉANCE", MARGE + 200, y - 14, { taille: 8, gras: true, couleur: BLANC });
  const enTeteMontant = "MONTANT DÛ";
  texte(enTeteMontant, colonneMontant - largeurTexte(enTeteMontant, 8, true), y - 14, {
    taille: 8,
    gras: true,
    couleur: BLANC,
  });
  y -= 20;

  for (const echeance of data.echeances) {
    page.drawLine({
      start: { x: MARGE, y: y - hauteurLigne },
      end: { x: LARGEUR - MARGE, y: y - hauteurLigne },
      thickness: 0.5,
      color: LIGNE,
    });
    texte(echeance.periodeLabel, MARGE + 12, y - 16, { taille: 10 });
    texte(echeance.echeanceLe, MARGE + 200, y - 16, { taille: 10, couleur: GRIS });
    const valeur = formaterEuros(echeance.montantCents);
    texte(valeur, colonneMontant - largeurTexte(valeur, 10), y - 16, { taille: 10 });
    y -= hauteurLigne;
  }

  page.drawRectangle({ x: MARGE, y: y - hauteurLigne, width: CONTENU, height: hauteurLigne, color: BLEU_PALE });
  texte("Total dû", MARGE + 12, y - 16, { taille: 11, gras: true });
  const valeurTotale = formaterEuros(total);
  texte(valeurTotale, colonneMontant - largeurTexte(valeurTotale, 11, true), y - 16, { taille: 11, gras: true });
  y -= hauteurLigne + 30;

  paragraphe("Nous restons à votre disposition pour convenir, si nécessaire, des modalités de régularisation.");
  y -= 20;

  // ── Signature ─────────────────────────────────────────────────────────────────────
  await dessinerCadreSignature(pdf, page, outils, { y, hauteur: 80, signature: data.signature });
  y -= 92;

  // ── Pied de page ──────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: MARGE, y: 58 }, end: { x: LARGEUR - MARGE, y: 58 }, thickness: 0.5, color: LIGNE });
  const piedGauche = [data.bailleur.nom, data.bailleur.siren ? `SIREN ${data.bailleur.siren}` : null]
    .filter(Boolean)
    .join(" · ");
  texte(piedGauche, MARGE, 44, { taille: 7.5, couleur: GRIS });
  const piedDroite = `${titre} ${data.reference}`;
  texte(piedDroite, LARGEUR - MARGE - largeurTexte(piedDroite, 7.5), 44, { taille: 7.5, couleur: GRIS });

  return pdf.save();
}
