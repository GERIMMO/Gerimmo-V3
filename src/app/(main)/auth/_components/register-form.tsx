"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { updatePasswordAction } from "../actions";
import { AuthMessage } from "./auth-message";

export function RegisterForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="activation-password">Nouveau mot de passe</FieldLabel>
          <Input id="activation-password" name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="activation-confirmation">Confirmation</FieldLabel>
          <Input
            id="activation-confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
      </FieldGroup>
      <AuthMessage message={state?.message} success={state?.success} />
      <Button type="submit" disabled={pending || state?.success}>
        {pending && <Spinner data-icon="inline-start" />}
        Activer mon compte
      </Button>
    </form>
  );
}
