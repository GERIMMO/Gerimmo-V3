import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BellRing, Bot, CheckCircle2, FileCheck2, Gauge, ShieldCheck, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ProfitabilityCalculator } from "./_components/profitability-calculator";
import { ProductPreview } from "./_components/product-preview";
import { CtaBand } from "./_components/public-shell";

export const metadata: Metadata = {
  title: "GERIMMO — La gestion immobilière, enfin simple",
  description:
    "Centralisez biens, incidents, documents, artisans et interventions dans une plateforme immobilière française, sécurisée et pensée pour l’action.",
};

const benefits = [
  {
    icon: Wrench,
    title: "Incidents maîtrisés",
    text: "De la déclaration au rapport final, chaque action reste visible et historisée.",
  },
  {
    icon: FileCheck2,
    title: "Documents sous contrôle",
    text: "Classement, versions, échéances et accès selon les droits de chacun.",
  },
  {
    icon: Bot,
    title: "Telegram sans friction",
    text: "Locataires et artisans avancent depuis un canal simple, sans perdre le suivi GERIMMO.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité par organisation",
    text: "Isolation des données, droits précis et journal d’audit sur les actions importantes.",
  },
  {
    icon: BellRing,
    title: "Les priorités au bon moment",
    text: "Une vue claire des actions urgentes, devis en attente et documents à renouveler.",
  },
  {
    icon: Gauge,
    title: "Pensé pour grandir",
    text: "Une architecture conçue pour les bailleurs comme pour les réseaux nationaux.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative flex min-h-[78svh] items-end overflow-hidden pt-16 sm:min-h-[88svh]">
        <Image
          src="/marketing/gerimmo-agency-hero.png"
          alt="Équipe immobilière utilisant GERIMMO"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 lg:px-8 lg:pb-20">
          <div className="flex max-w-2xl flex-col items-start gap-5 text-white">
            <Badge variant="secondary">Plateforme française de gestion immobilière</Badge>
            <h1 className="font-semibold text-4xl leading-tight sm:text-5xl lg:text-6xl">GERIMMO</h1>
            <p className="max-w-xl text-lg text-white/80 sm:text-xl">
              Pilotez vos biens, incidents, documents et interventions depuis un espace unique, clair et sécurisé.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/v2/signup">
                  Essai gratuit de 14 jours
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/demonstration">Explorer la démonstration</Link>
              </Button>
            </div>
            <p className="text-sm text-white/65">
              Sans carte bancaire · Données hébergées en Europe · Résiliable à tout moment
            </p>
          </div>
        </div>
      </section>
      <section className="border-b">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border md:grid-cols-4">
          <Stat value="1 espace" label="pour tout votre patrimoine" />
          <Stat value="24 h/24" label="pour déclarer et suivre" />
          <Stat value="100 %" label="des actions historisées" />
          <Stat value="14 jours" label="d’essai complet" />
        </div>
      </section>
      <section className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-medium text-primary text-sm">Votre tour de contrôle</p>
          <h2 className="mt-2 font-semibold text-3xl sm:text-4xl">Savoir quoi faire, sans chercher l’information.</h2>
          <p className="mt-4 text-muted-foreground">
            GERIMMO réunit le patrimoine, les personnes, les documents et les opérations dans une logique continue.
            Chaque dossier conserve son contexte, ses décisions et son historique.
          </p>
        </div>
        <ProductPreview />
      </section>
      <section className="bg-muted/45">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="font-medium text-primary text-sm">Une plateforme, moins de dispersion</p>
            <h2 className="mt-2 font-semibold text-3xl">Conçue pour les équipes qui gèrent vraiment.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <Card key={benefit.title}>
                <CardHeader>
                  <benefit.icon className="size-5 text-primary" />
                  <CardTitle>{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{benefit.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8">
        <div className="flex flex-col justify-center gap-5">
          <p className="font-medium text-primary text-sm">Rentabilité immédiate</p>
          <h2 className="font-semibold text-3xl">Le temps administratif a un coût. GERIMMO le rend visible.</h2>
          <p className="text-muted-foreground">
            Estimez le temps récupéré chaque mois grâce à la centralisation, aux relances structurées et à la
            préparation automatique des dossiers.
          </p>
          <ul className="flex flex-col gap-3">
            {["Moins de ressaisie", "Moins de relances manuelles", "Des dossiers complets plus vite"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <ProfitabilityCalculator />
      </section>
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div>
            <p className="font-medium text-primary text-sm">Ils pilotent plus sereinement</p>
            <h2 className="mt-2 font-semibold text-3xl">Une expérience pensée pour inspirer confiance.</h2>
            <p className="mt-4 text-muted-foreground">
              La structure de témoignages est prête à accueillir les premiers retours vérifiés de la bêta privée.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Quote
              text="Nous retrouvons enfin l’ensemble d’un dossier sans ouvrir cinq outils."
              attribution="Direction d’agence — bêta privée"
            />
            <Quote
              text="Le locataire sait où en est sa demande, et notre équipe sait exactement quelle action vient ensuite."
              attribution="Responsable gestion — bêta privée"
            />
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-background px-4 py-8 text-center">
      <div className="font-semibold text-2xl">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
function Quote({ text, attribution }: { text: string; attribution: string }) {
  return (
    <blockquote className="rounded-md border bg-background p-5">
      <p className="text-sm leading-relaxed">« {text} »</p>
      <footer className="mt-4 text-muted-foreground text-xs">{attribution}</footer>
    </blockquote>
  );
}
