"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Building2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizationBranding } from "@/types/organization-branding";

type OrganizationOption = { id: string; name: string };

export function AgencyBrandingSettings({
  initialBranding,
  organizations,
}: {
  initialBranding: OrganizationBranding;
  organizations: OrganizationOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initialBranding);
  const [saving, setSaving] = useState(false);
  const displayedName = form.branding_enabled && form.display_name?.trim() ? form.display_name : "GERIMMO";
  const welcome =
    form.branding_enabled && form.welcome_message?.trim()
      ? form.welcome_message
      : `Bienvenue dans l assistance de ${displayedName}.`;
  const signature =
    form.branding_enabled && form.support_signature?.trim() ? form.support_signature : `L equipe ${displayedName}`;

  function update(field: keyof OrganizationBranding, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(restore = false) {
    setSaving(true);
    const response = await fetch("/api/bot/telegram/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, restore }),
    });
    const payload = (await response.json()) as OrganizationBranding & { message?: string };
    setSaving(false);
    if (!response.ok) return toast.error(payload.message ?? "Enregistrement impossible.");
    setForm(payload);
    toast.success(restore ? "Identite GERIMMO restauree." : "Personnalisation enregistree.");
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Identite Telegram</h1>
          <p className="text-muted-foreground text-sm">Personnalisation des messages de l agence.</p>
        </div>
        {organizations.length > 1 ? (
          <div className="w-full max-w-xs space-y-1.5">
            <Label>Organisation</Label>
            <Select
              value={form.organization_id}
              onValueChange={(value) => router.replace(`/dashboard/parametres/telegram?organizationId=${value}`)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-sm">Activer l identite de l agence</div>
              <div className="text-muted-foreground text-xs">
                Disponible uniquement pour une agence immobiliere reconnue.
              </div>
            </div>
            <Switch
              checked={form.branding_enabled}
              disabled={!form.is_agency}
              onCheckedChange={(checked) => update("branding_enabled", checked)}
              aria-label="Activer la personnalisation"
            />
          </div>

          {!form.is_agency ? (
            <div className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
              Cette organisation utilise obligatoirement l identite GERIMMO.
            </div>
          ) : null}

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nom commercial">
              <Input value={form.display_name ?? ""} onChange={(event) => update("display_name", event.target.value)} />
            </Field>
            <Field label="Logo (URL)">
              <Input value={form.logo_url ?? ""} onChange={(event) => update("logo_url", event.target.value)} />
            </Field>
            <Field label="E-mail d assistance">
              <Input
                type="email"
                value={form.support_email ?? ""}
                onChange={(event) => update("support_email", event.target.value)}
              />
            </Field>
            <Field label="Telephone d assistance">
              <Input
                value={form.support_phone ?? ""}
                onChange={(event) => update("support_phone", event.target.value)}
              />
            </Field>
            <Field label="Horaires de contact" className="md:col-span-2">
              <Input
                value={form.opening_hours ?? ""}
                onChange={(event) => update("opening_hours", event.target.value)}
              />
            </Field>
            <Field label="Formule d accueil" className="md:col-span-2">
              <Textarea
                rows={2}
                value={form.welcome_message ?? ""}
                onChange={(event) => update("welcome_message", event.target.value)}
              />
            </Field>
            <Field label="Signature" className="md:col-span-2">
              <Textarea
                rows={2}
                value={form.support_signature ?? ""}
                onChange={(event) => update("support_signature", event.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => save(true)}>
              <RotateCcw data-icon="inline-start" />
              Restaurer GERIMMO
            </Button>
            <Button type="button" disabled={saving || !form.is_agency} onClick={() => save()}>
              <Save data-icon="inline-start" />
              Enregistrer
            </Button>
          </div>
        </section>

        <aside className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm">Apercu Telegram</div>
            <Badge variant={form.branding_enabled && form.is_agency ? "default" : "secondary"}>
              {form.branding_enabled && form.is_agency ? "Agence" : "GERIMMO"}
            </Badge>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Avatar size="lg">
                {form.logo_url ? <AvatarImage src={form.logo_url} alt="Logo de l agence" /> : null}
                <AvatarFallback>
                  <Building2 className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-sm">{displayedName}</div>
                <div className="text-muted-foreground text-xs">Assistance immobiliere</div>
              </div>
            </div>
            <div className="rounded-md bg-background p-3 text-sm shadow-xs">
              <p>{welcome}</p>
              <p className="mt-3 text-muted-foreground text-xs">{signature}</p>
              {form.support_email || form.support_phone || form.opening_hours ? (
                <p className="mt-2 text-muted-foreground text-xs">
                  {[form.support_email, form.support_phone, form.opening_hours].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
