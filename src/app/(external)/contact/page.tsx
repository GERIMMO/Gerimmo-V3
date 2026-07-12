import type { Metadata } from "next";

import { CommercialForm } from "../_components/commercial-form";

export const metadata: Metadata = {
  title: "Contacter GERIMMO",
  description: "Demandez une démonstration, un devis ou un rappel pour votre agence immobilière.",
};
export default function Page() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-32 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <p className="font-medium text-primary text-sm">Parlons de votre gestion</p>
        <h1 className="mt-3 font-semibold text-4xl">Voyez GERIMMO avec vos propres enjeux.</h1>
        <p className="mt-4 text-muted-foreground">
          Demandez une démonstration, un devis ou un rappel. Nous préparons un échange adapté à votre portefeuille.
        </p>
        <div className="mt-8 flex flex-col gap-5 text-sm">
          <Point title="Démonstration ciblée" text="Un parcours centré sur vos volumes et vos priorités." />
          <Point title="Aucun engagement" text="L’échange permet simplement de vérifier l’adéquation." />
          <Point title="Accompagnement français" text="Mise en place, import et démarrage avec une équipe dédiée." />
        </div>
      </div>
      <CommercialForm />
    </section>
  );
}
function Point({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-l-2 border-primary pl-4">
      <div className="font-medium">{title}</div>
      <div className="text-muted-foreground">{text}</div>
    </div>
  );
}
