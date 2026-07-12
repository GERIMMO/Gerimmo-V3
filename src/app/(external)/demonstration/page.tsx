import type { Metadata } from "next";

import { DemoCenter } from "../_components/demo-center";
import { CtaBand } from "../_components/public-shell";

export const metadata: Metadata = {
  title: "Démonstration GERIMMO",
  description: "Explorez une agence immobilière fictive complète et découvrez le fonctionnement concret de GERIMMO.",
};
export default function Page() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pb-10 pt-32">
        <p className="font-medium text-primary text-sm">Centre Démonstration</p>
        <h1 className="mt-3 font-semibold text-4xl">Explorez une agence déjà opérationnelle.</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Toutes les informations présentées sont fictives. Découvrez comment GERIMMO relie patrimoine, personnes et
          opérations.
        </p>
      </section>
      <DemoCenter />
      <CtaBand />
    </>
  );
}
