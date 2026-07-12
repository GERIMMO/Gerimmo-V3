"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { signupBusinessAction } from "../actions";
import { AuthMessage } from "./auth-message";

export function SignupBusinessForm() {
  const [state, action, pending] = useActionState(signupBusinessAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="signup-type">Type de compte</FieldLabel>
          <select
            id="signup-type"
            name="account_type"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            defaultValue="agency"
          >
            <option value="agency">Agence immobilière</option>
            <option value="independent_owner">Propriétaire bailleur</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-name">Nom complet</FieldLabel>
          <Input id="signup-name" name="full_name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-email">Adresse e-mail</FieldLabel>
          <Input id="signup-email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-password">Mot de passe</FieldLabel>
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </FieldGroup>
      <AuthMessage message={state?.message} success={state?.success} />
      <Button type="submit" disabled={pending || state?.success}>
        {pending && <Spinner data-icon="inline-start" />}Créer mon compte
      </Button>
    </form>
  );
}
