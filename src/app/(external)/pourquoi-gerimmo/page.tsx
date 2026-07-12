import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { CtaBand } from "../_components/public-shell";

export const metadata: Metadata = {
  title: "Pourquoi GERIMMO ?",
  description:
    "Comparez la gestion immobilière classique avec une plateforme centralisée, sécurisée et conçue pour le suivi opérationnel.",
};
const comparisons = [
  ["Suivi des incidents", "E-mails, appels et fichiers dispersés", "Dossier unique, chronologie complète"],
  ["Relances", "Manuelles et difficiles à tracer", "Actions structurées et échéances visibles"],
  ["Documents", "Dossiers partagés sans contexte", "Droits, versions, expiration et historique"],
  ["Artisans", "Disponibilités collectées séparément", "Devis, créneaux et interventions rattachés"],
  ["Locataires", "Peu de visibilité sur l’avancement", "Suivi autorisé depuis Telegram"],
  ["Sécurité", "Accès souvent trop larges", "Isolation par organisation et audit"],
  ["Pilotage", "Tableaux reconstitués à la main", "Indicateurs et priorités en temps réel"],
] as const;
export default function Page() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-5 pb-14 pt-32 text-center">
        <Badge variant="secondary">Pourquoi GERIMMO ?</Badge>
        <h1 className="mt-4 font-semibold text-4xl sm:text-5xl">Moins d’outils. Plus de maîtrise.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          GERIMMO ne remplace pas votre expertise. Il élimine la dispersion qui vous empêche de l’exercer pleinement.
        </p>
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b bg-muted/60 px-4 py-3 text-sm">
            <span>Enjeu</span>
            <span>Gestion classique</span>
            <span className="font-medium text-primary">GERIMMO</span>
          </div>
          {comparisons.map(([topic, classic, gerimmo]) => (
            <div key={topic} className="grid grid-cols-[1fr_1fr_1fr] gap-3 border-b px-4 py-4 text-sm last:border-0">
              <strong>{topic}</strong>
              <span className="flex gap-2 text-muted-foreground">
                <Minus className="size-4 shrink-0" />
                {classic}
              </span>
              <span className="flex gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                {gerimmo}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <Value value="28 %" label="de temps administratif potentiellement récupéré" />
          <Value value="1" label="chronologie continue par dossier" />
          <Value value="100 %" label="des actions importantes auditables" />
        </div>
      </section>
      <CtaBand />
    </>
  );
}
function Value({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l-2 border-primary pl-4">
      <div className="font-semibold text-3xl">{value}</div>
      <div className="mt-1 text-muted-foreground text-sm">{label}</div>
    </div>
  );
}
