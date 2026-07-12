"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { loginAction } from "../actions";
import { AuthMessage } from "./auth-message";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-email">Adresse e-mail</FieldLabel>
          <Input id="login-email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="login-password">Mot de passe</FieldLabel>
            <Link href="/auth/forgot-password" className="text-muted-foreground text-xs hover:text-foreground">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      </FieldGroup>
      <AuthMessage message={state?.message} />
      <Button type="submit" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        Se connecter
      </Button>
    </form>
  );
}
