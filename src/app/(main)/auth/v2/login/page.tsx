import Link from "next/link";

import { LoginForm } from "../../_components/login-form";

export default function LoginV2() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">Connexion</h1>
          <p className="text-muted-foreground text-sm">Accédez à votre espace sécurisé GERIMMO.</p>
        </div>
        <div className="space-y-4">
          <LoginForm />
        </div>
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-muted-foreground text-sm">
          Première connexion ?{" "}
          <Link prefetch={false} className="text-foreground" href="register">
            Activer mon invitation
          </Link>
        </div>
      </div>
    </>
  );
}
