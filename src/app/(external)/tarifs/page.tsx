import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { agencyPlans, ownerPlans } from "@/config/public-pricing";

import { CtaBand } from "../_components/public-shell";

export const metadata: Metadata = {
  title: "Tarifs GERIMMO",
  description:
    "Des tarifs clairs pour les propriétaires bailleurs et les agences immobilières. Essai gratuit de 14 jours.",
};

export default function Page() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-5 pb-12 pt-32 text-center">
        <p className="font-medium text-primary text-sm">Des offres qui suivent votre patrimoine</p>
        <h1 className="mt-3 font-semibold text-4xl sm:text-5xl">Simple à choisir. Clair à budgéter.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          14 jours d’essai complet, sans carte bancaire. Les données restent conservées si vous interrompez votre
          abonnement.
        </p>
      </section>
      <PricingSection
        title="Propriétaires bailleurs"
        subtitle="Pour gérer directement votre patrimoine."
        plans={ownerPlans}
      />
      <PricingSection
        title="Agences immobilières"
        subtitle="Pour les équipes et portefeuilles professionnels."
        plans={agencyPlans}
      />
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-6 border-y py-10 md:grid-cols-3">
          <Info
            title="Mise en place"
            text="Configuration initiale, préparation de l’espace et accompagnement au démarrage."
          />
          <Info
            title="Gestion annuelle"
            text="Maintenance, assistance, mises à jour réglementaires et évolution de la plateforme."
          />
          <Info
            title="Essai gratuit"
            text="Toutes les fonctions pendant 14 jours, sans carte bancaire et sans engagement."
          />
        </div>
      </section>
      <CtaBand />
    </>
  );
}

function PricingSection({
  title,
  subtitle,
  plans,
}: {
  title: string;
  subtitle: string;
  plans: readonly { range: string; monthly: number | null; setup: number | null; annual: number | null }[];
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="mb-6">
        <h2 className="font-semibold text-2xl">{title}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {plans.map((plan) => (
          <Card key={plan.range}>
            <CardHeader>
              <CardTitle>{plan.range}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <span className="font-semibold text-3xl">
                  {plan.monthly === null ? "Sur devis" : `${plan.monthly} €`}
                </span>
                {plan.monthly !== null && <span className="text-muted-foreground text-sm"> / mois</span>}
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex gap-2">
                  <Check className="size-4 text-primary" />
                  Mise en place : {plan.setup === null ? "sur devis" : `${plan.setup} €`}
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 text-primary" />
                  Gestion annuelle : {plan.annual === null ? "sur devis" : `${plan.annual} €`}
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 text-primary" />
                  14 jours offerts
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant={plan.monthly === null ? "outline" : "default"}>
                <Link href={plan.monthly === null ? "/contact" : "/auth/v2/signup"}>
                  {plan.monthly === null ? "Nous contacter" : "Commencer"}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      {title.startsWith("Propriétaires") && (
        <p className="mt-5 text-muted-foreground text-sm">
          Au-delà de 50 biens, nous vous orientons vers une offre Agence adaptée.
        </p>
      )}
    </section>
  );
}
function Info({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
