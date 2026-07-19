import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — GERIMMO",
  description:
    "Comment GERIMMO collecte, utilise et protège les données personnelles des agences, propriétaires, locataires et artisans.",
};

// Date de dernière mise à jour (statique : à modifier lors d'une révision réelle du document).
const LAST_UPDATED = "19 juillet 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-semibold text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-32">
      <p className="font-medium text-primary text-sm">Mentions RGPD</p>
      <h1 className="mt-3 font-semibold text-4xl">Politique de confidentialité</h1>
      <p className="mt-4 text-muted-foreground">Dernière mise à jour : {LAST_UPDATED}.</p>

      <Section title="1. Responsable du traitement">
        <p>
          GERIMMO est une plateforme de gestion immobilière éditée par [À compléter : raison sociale], [À compléter :
          forme juridique et capital], immatriculée sous le numéro [À compléter : SIREN/SIRET], dont le siège est situé
          [À compléter : adresse].
        </p>
        <p>
          Pour toute question relative à vos données personnelles, vous pouvez nous contacter à l’adresse [À compléter :
          e-mail de contact / DPO] ou via notre page de contact.
        </p>
      </Section>

      <Section title="2. Données que nous collectons">
        <p>Dans le cadre de l’utilisation de GERIMMO, nous traitons notamment :</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Données de compte</strong> : nom, adresse e-mail, rôle (agence, propriétaire, agent, locataire,
            artisan), organisation de rattachement.
          </li>
          <li>
            <strong>Données de gestion</strong> : biens, patrimoines, occupations, loyers et échéances, documents,
            incidents, devis et interventions.
          </li>
          <li>
            <strong>Échanges via nos assistants de messagerie</strong> (WhatsApp, Telegram) : identifiant de messagerie,
            contenu des messages liés à vos demandes, pièces jointes envoyées (photos d’incident, documents).
          </li>
          <li>
            <strong>Données techniques</strong> : journaux de connexion et d’activité nécessaires à la sécurité et au
            bon fonctionnement du service.
          </li>
        </ul>
      </Section>

      <Section title="3. Finalités et bases légales">
        <p>Vos données sont utilisées pour :</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>fournir le service de gestion immobilière (exécution du contrat) ;</li>
          <li>
            permettre les échanges avec les locataires, propriétaires et artisans, y compris via les assistants WhatsApp
            et Telegram (exécution du contrat) ;
          </li>
          <li>émettre les documents et quittances, et adresser les rappels et relances (exécution du contrat) ;</li>
          <li>
            assurer la sécurité, prévenir la fraude et respecter nos obligations légales (obligation légale et intérêt
            légitime) ;
          </li>
          <li>vous informer d’évolutions du service (intérêt légitime, avec possibilité de refus).</li>
        </ul>
      </Section>

      <Section title="4. Hébergement et localisation des données">
        <p>
          Les données de GERIMMO sont hébergées au sein de l’Union européenne (base de données et stockage de fichiers
          en région Europe). Aucun transfert de données n’est effectué en dehors de l’Union européenne sans garanties
          appropriées.
        </p>
      </Section>

      <Section title="5. Prestataires et services tiers">
        <p>
          Pour fournir le service, nous nous appuyons sur des sous-traitants qui traitent des données pour notre compte
          :
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Supabase</strong> — hébergement de la base de données, authentification et stockage de fichiers
            (UE).
          </li>
          <li>
            <strong>Vercel</strong> — hébergement et diffusion de l’application.
          </li>
          <li>
            <strong>Resend</strong> — envoi des e-mails transactionnels (confirmations, quittances, rappels).
          </li>
          <li>
            <strong>Meta Platforms (WhatsApp Business)</strong> et <strong>Telegram</strong> — acheminement des messages
            de l’assistant. Les échanges via ces canaux sont également soumis aux politiques de confidentialité de ces
            services.
          </li>
          <li>
            <strong>Stripe</strong> — traitement des paiements d’abonnement. GERIMMO ne stocke pas vos coordonnées
            bancaires.
          </li>
        </ul>
      </Section>

      <Section title="6. Durées de conservation">
        <p>
          Vos données sont conservées le temps nécessaire aux finalités décrites, puis archivées ou supprimées selon les
          obligations légales applicables (notamment comptables et fiscales). Les échanges liés aux assistants de
          messagerie sont conservés le temps du suivi de la demande concernée.
        </p>
      </Section>

      <Section title="7. Vos droits">
        <p>
          Conformément au Règlement général sur la protection des données (RGPD), vous disposez d’un droit d’accès, de
          rectification, d’effacement, de limitation, d’opposition et de portabilité de vos données, ainsi que du droit
          de définir des directives relatives à leur sort après votre décès.
        </p>
        <p>
          Vous pouvez exercer ces droits depuis votre espace GERIMMO ou en nous contactant à [À compléter : e-mail de
          contact / DPO]. Vous avez également le droit d’introduire une réclamation auprès de la CNIL (www.cnil.fr).
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          GERIMMO utilise uniquement les cookies strictement nécessaires au fonctionnement du service (authentification,
          sécurité). Aucun cookie publicitaire ou de suivi tiers n’est déposé sans votre consentement.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          Cette politique peut être mise à jour pour refléter des évolutions du service ou de la réglementation. La date
          de dernière mise à jour figure en haut de cette page.
        </p>
      </Section>
    </section>
  );
}
