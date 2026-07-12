import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CirclePlay, FileQuestion, Rocket } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Centre d’aide GERIMMO",
  description: "FAQ, premiers pas, tutoriels et documentation pour découvrir et utiliser GERIMMO.",
};
const faqs = [
  [
    "Puis-je tester GERIMMO sans carte bancaire ?",
    "Oui. L’essai dure 14 jours et donne accès à toutes les fonctionnalités.",
  ],
  [
    "Mes données sont-elles séparées de celles des autres agences ?",
    "Oui. GERIMMO applique une isolation stricte par organisation et des politiques d’accès au niveau de la base.",
  ],
  [
    "Comment importer mes biens ?",
    "Un import CSV ou Excel valide les lignes, détecte les doublons et fournit un rapport avant intégration.",
  ],
  [
    "Telegram est-il obligatoire ?",
    "Non. Il complète le dashboard pour simplifier les échanges avec locataires et artisans.",
  ],
  [
    "Que se passe-t-il après l’essai ?",
    "Sans abonnement, l’accès est suspendu mais les données restent conservées. Il suffit de souscrire pour reprendre.",
  ],
  [
    "Puis-je gérer plusieurs centaines de biens ?",
    "Oui. Les offres Agence couvrent jusqu’à 600 biens, puis un accompagnement sur mesure est proposé.",
  ],
] as const;
export default function Page() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-32">
      <div className="max-w-2xl">
        <p className="font-medium text-primary text-sm">Centre d’aide</p>
        <h1 className="mt-3 font-semibold text-4xl">Bien démarrer avec GERIMMO.</h1>
        <p className="mt-4 text-muted-foreground">
          Des réponses courtes, des parcours guidés et une documentation organisée par objectif.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-4">
        <HelpCard
          icon={Rocket}
          title="Premiers pas"
          text="Créer l’agence, importer et inviter l’équipe."
          href="/demarrer"
        />
        <HelpCard
          icon={BookOpen}
          title="Documentation"
          text="Comprendre les modules et les permissions."
          href="/demonstration"
        />
        <HelpCard
          icon={CirclePlay}
          title="Vidéos"
          text="Structure prête pour les tutoriels de lancement."
          href="/contact"
        />
        <HelpCard icon={FileQuestion} title="Assistance" text="Échanger avec l’équipe GERIMMO." href="/contact" />
      </div>
      <div className="mt-14 grid gap-10 lg:grid-cols-[.65fr_1.35fr]">
        <div>
          <h2 className="font-semibold text-2xl">Questions fréquentes</h2>
          <p className="mt-2 text-muted-foreground text-sm">L’essentiel avant de commencer.</p>
        </div>
        <Accordion type="single" collapsible>
          {faqs.map(([question, answer]) => (
            <AccordionItem key={question} value={question}>
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionContent>{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
function HelpCard({
  icon: Icon,
  title,
  text,
  href,
}: {
  icon: typeof Rocket;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <Card>
      <CardHeader>
        <Icon className="size-5 text-primary" />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-muted-foreground text-sm">{text}</p>
        <Button asChild variant="link" className="px-0">
          <Link href={href}>Ouvrir</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
