import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Démarrer avec GERIMMO",
  description: "Le parcours guidé pour rendre votre agence opérationnelle avec GERIMMO.",
};
const steps = [
  ["01", "Créer votre compte", "Activez votre espace sécurisé et votre essai de 14 jours."],
  ["02", "Choisir votre offre", "Sélectionnez la tranche correspondant au nombre de biens gérés."],
  ["03", "Importer votre patrimoine", "Contrôlez le fichier CSV ou Excel avant intégration."],
  ["04", "Personnaliser votre agence", "Ajoutez identité, coordonnées, horaires et signature."],
  ["05", "Inviter votre équipe", "Créez les accès et attribuez les rôles adaptés."],
  ["06", "Connecter Telegram", "Associez les utilisateurs avec un lien personnel sécurisé."],
  ["07", "Créer le premier dossier", "Ajoutez un incident et un document pour valider le parcours."],
  ["08", "Passer en exploitation", "Retrouvez les actions prioritaires depuis votre accueil."],
] as const;
export default function Page() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-20 pt-32">
      <div className="max-w-2xl">
        <p className="font-medium text-primary text-sm">Onboarding commercial</p>
        <h1 className="mt-3 font-semibold text-4xl">De la découverte à la première action utile.</h1>
        <p className="mt-4 text-muted-foreground">
          Un parcours progressif vous accompagne jusqu’à une plateforme réellement opérationnelle.
        </p>
      </div>
      <div className="mt-12 grid gap-x-10 gap-y-2 md:grid-cols-2">
        {steps.map(([number, title, text]) => (
          <div key={number} className="flex gap-4 border-b py-5">
            <span className="font-medium text-primary text-sm">{number}</span>
            <div>
              <h2 className="font-medium">{title}</h2>
              <p className="mt-1 text-muted-foreground text-sm">{text}</p>
            </div>
            <Check className="ml-auto size-4 text-primary" />
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/auth/v2/signup">
            Créer mon compte
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/contact">Être accompagné</Link>
        </Button>
      </div>
    </section>
  );
}
