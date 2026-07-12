"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CommercialForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true);
    const response = await fetch("/api/commercial", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      toast.error(data.message ?? "Envoi impossible.");
      return;
    }
    setSent(true);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{sent ? "Demande reçue" : "Votre demande"}</CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-muted-foreground text-sm">
            Merci. Votre demande est enregistrée et sera traitée selon le type d’échange choisi.
          </p>
        ) : (
          <form action={submit}>
            <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="contact-name">Nom complet</FieldLabel>
                <Input id="contact-name" name="full_name" required minLength={2} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-email">E-mail professionnel</FieldLabel>
                <Input id="contact-email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-company">Agence ou société</FieldLabel>
                <Input id="contact-company" name="company" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-properties">Nombre de biens</FieldLabel>
                <Input id="contact-properties" name="properties_count" type="number" min={1} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-type">Type de demande</FieldLabel>
                <select
                  id="contact-type"
                  name="request_type"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="demo">Démonstration</option>
                  <option value="appointment">Prise de rendez-vous</option>
                  <option value="quote">Devis</option>
                  <option value="callback">Rappel</option>
                  <option value="contact">Contact</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-message">Votre contexte</FieldLabel>
                <Textarea id="contact-message" name="message" rows={5} />
              </Field>
              <Field orientation="horizontal">
                <Checkbox id="contact-consent" name="consent" value="accepted" required />
                <FieldLabel htmlFor="contact-consent" className="font-normal text-muted-foreground text-xs">
                  J’accepte que GERIMMO utilise ces informations pour répondre à ma demande commerciale.
                </FieldLabel>
              </Field>
              <Button type="submit" disabled={pending}>
                <Send data-icon="inline-start" />
                {pending ? "Envoi…" : "Envoyer"}
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
