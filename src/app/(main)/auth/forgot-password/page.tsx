"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { forgotPasswordAction } from "../actions";
import { AuthMessage } from "../_components/auth-message";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <section className="flex w-full max-w-sm flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl">Réinitialiser l’accès</h1>
          <p className="text-muted-foreground text-sm">Recevez un lien sécurisé par e-mail.</p>
        </div>
        <form action={action} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="forgot-email">Adresse e-mail</FieldLabel>
              <Input id="forgot-email" name="email" type="email" required />
            </Field>
          </FieldGroup>
          <AuthMessage message={state?.message} success={state?.success} />
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}Envoyer le lien
          </Button>
        </form>
        <Button asChild variant="ghost">
          <Link href="/auth/v2/login">Retour à la connexion</Link>
        </Button>
      </section>
    </main>
  );
}
