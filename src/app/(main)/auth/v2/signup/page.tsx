import Link from "next/link";

import { Button } from "@/components/ui/button";

import { SignupBusinessForm } from "../../_components/signup-business-form";

export default function Page() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-semibold text-2xl">Créer votre compte</h1>
        <p className="text-muted-foreground text-sm">
          Agence ou propriétaire bailleur, 14 jours d’essai sans carte bancaire.
        </p>
      </div>
      <SignupBusinessForm />
      <Button asChild variant="ghost">
        <Link href="/auth/v2/login">J’ai déjà un compte</Link>
      </Button>
    </div>
  );
}
