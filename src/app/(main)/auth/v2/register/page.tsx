import Link from "next/link";

import { RegisterForm } from "../../_components/register-form";

export default function RegisterV2() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Activer mon compte</h1>
          <p className="text-muted-foreground text-sm">Ouvrez d’abord le lien personnel reçu dans votre invitation.</p>
        </div>
        <div className="space-y-4">
          <RegisterForm />
        </div>
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-muted-foreground text-sm">
          Compte déjà activé ?{" "}
          <Link prefetch={false} className="text-foreground" href="login">
            Se connecter
          </Link>
        </div>
      </div>
    </>
  );
}
