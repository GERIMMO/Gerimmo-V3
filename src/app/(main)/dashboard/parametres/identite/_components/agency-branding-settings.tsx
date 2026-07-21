"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Building2, RotateCcw, Save, Upload } from "lucide-react";
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
import type { OrganizationBranding, OrganizationLegalIdentity } from "@/types/organization-branding";

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
  const [legal, setLegal] = useState(initialBranding.legal);
  const [saving, setSaving] = useState(false);
  const [logoEnCours, setLogoEnCours] = useState(false);
  const fichierLogo = useRef<HTMLInputElement>(null);

  async function deposerLogo(fichier: File) {
    setLogoEnCours(true);
    const corps = new FormData();
    corps.append("organizationId", form.organization_id);
    corps.append("file", fichier);
    const response = await fetch("/api/organization/logo", { method: "POST", body: corps });
    const payload = (await response.json()) as { logo_url?: string; message?: string };
    setLogoEnCours(false);
    if (!response.ok || !payload.logo_url) {
      toast.error(payload.message ?? "Dépôt impossible.");
      return;
    }
    setForm((current) => ({ ...current, logo_url: payload.logo_url ?? null }));
    toast.success("Logo déposé.");
  }

  const displayedName = form.branding_enabled && form.display_name?.trim() ? form.display_name : "GERIMMO";
  const welcome =
    form.branding_enabled && form.welcome_message?.trim()
      ? form.welcome_message
      : `Bienvenue dans l assistance de ${displayedName}.`;
  const signature =
    form.branding_enabled && form.support_signature?.trim() ? form.support_signature : `L equipe ${displayedName}`;

  function updateBranding(field: keyof OrganizationBranding, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function updateLegal(field: keyof OrganizationLegalIdentity, value: string) {
    setLegal((current) => ({ ...current, [field]: value }));
  }

  async function envoyer(body: Record<string, unknown>, succes: string) {
    setSaving(true);
    const response = await fetch("/api/bot/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as OrganizationBranding & { message?: string };
    setSaving(false);
    if (!response.ok) {
      toast.error(payload.message ?? "Enregistrement impossible.");
      return;
    }
    setForm(payload);
    setLegal(payload.legal);
    toast.success(succes);
  }

  const saveIdentite = () =>
    envoyer({ section: "identite", organization_id: form.organization_id, ...legal }, "Identité légale enregistrée.");
  const saveBranding = (restore = false) =>
    envoyer({ ...form, restore }, restore ? "Identité GERIMMO restaurée." : "Personnalisation enregistrée.");

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Identité de l organisation</h1>
          <p className="text-muted-foreground text-sm">
            Coordonnées reprises sur vos documents, et personnalisation du bot pour les agences.
          </p>
        </div>
        {organizations.length > 1 ? (
          <div className="w-full max-w-xs space-y-1.5">
            <Label>Organisation</Label>
            <Select
              value={form.organization_id}
              onValueChange={(value) => router.replace(`/dashboard/parametres/identite?organizationId=${value}`)}
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

      {/* Identité légale — pour tous : agences ET propriétaires. C'est elle qui figure en
          tête des quittances et courriers. */}
      <section className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <div className="font-medium text-sm">Identité légale</div>
          <div className="text-muted-foreground text-xs">
            Figure sur les quittances, relances et mises en demeure comme bailleur ou mandataire.
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Raison sociale">
            <Input value={legal.legal_name ?? ""} onChange={(event) => updateLegal("legal_name", event.target.value)} />
          </Field>
          <Field label="SIREN / SIRET">
            <Input value={legal.siren ?? ""} onChange={(event) => updateLegal("siren", event.target.value)} />
          </Field>
          <Field label="Adresse" className="md:col-span-2">
            <Input
              value={legal.address_line1 ?? ""}
              onChange={(event) => updateLegal("address_line1", event.target.value)}
            />
          </Field>
          <Field label="Complément d adresse" className="md:col-span-2">
            <Input
              value={legal.address_line2 ?? ""}
              onChange={(event) => updateLegal("address_line2", event.target.value)}
            />
          </Field>
          <Field label="Code postal">
            <Input
              value={legal.postal_code ?? ""}
              onChange={(event) => updateLegal("postal_code", event.target.value)}
            />
          </Field>
          <Field label="Ville">
            <Input value={legal.city ?? ""} onChange={(event) => updateLegal("city", event.target.value)} />
          </Field>
          <Field label="E-mail de contact">
            <Input
              type="email"
              value={legal.contact_email ?? ""}
              onChange={(event) => updateLegal("contact_email", event.target.value)}
            />
          </Field>
          <Field label="Téléphone de contact">
            <Input
              value={legal.contact_phone ?? ""}
              onChange={(event) => updateLegal("contact_phone", event.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="button" disabled={saving} onClick={() => saveIdentite()}>
            <Save data-icon="inline-start" />
            Enregistrer l identité
          </Button>
        </div>
      </section>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-sm">Apparence du bot</div>
              <div className="text-muted-foreground text-xs">
                Logo, couleur et messages affichés à vos clients. Réservé aux agences.
              </div>
            </div>
            <Switch
              checked={form.branding_enabled}
              disabled={!form.is_agency}
              onCheckedChange={(checked) => updateBranding("branding_enabled", checked)}
              aria-label="Activer la personnalisation"
            />
          </div>

          {!form.is_agency ? (
            <div className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
              L apparence du bot utilise l identité GERIMMO. Votre identité légale ci-dessus reste, elle, la vôtre.
            </div>
          ) : null}

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nom commercial">
              <Input
                value={form.display_name ?? ""}
                onChange={(event) => updateBranding("display_name", event.target.value)}
              />
            </Field>
            <Field label="Logo">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  {form.logo_url ? <AvatarImage src={form.logo_url} alt="Logo" /> : null}
                  <AvatarFallback>
                    <Building2 className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fichierLogo}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const fichier = event.target.files?.[0];
                    if (fichier) void deposerLogo(fichier);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={logoEnCours || !form.is_agency}
                  onClick={() => fichierLogo.current?.click()}
                >
                  <Upload data-icon="inline-start" />
                  {logoEnCours ? "Dépôt…" : form.logo_url ? "Remplacer" : "Déposer une image"}
                </Button>
              </div>
            </Field>
            <Field label="E-mail d assistance">
              <Input
                type="email"
                value={form.support_email ?? ""}
                onChange={(event) => updateBranding("support_email", event.target.value)}
              />
            </Field>
            <Field label="Téléphone d assistance">
              <Input
                value={form.support_phone ?? ""}
                onChange={(event) => updateBranding("support_phone", event.target.value)}
              />
            </Field>
            <Field label="Horaires de contact">
              <Input
                value={form.opening_hours ?? ""}
                onChange={(event) => updateBranding("opening_hours", event.target.value)}
              />
            </Field>
            <Field label="Couleur principale">
              <Input
                type="color"
                value={form.primary_color ?? "#244a7c"}
                onChange={(event) => updateBranding("primary_color", event.target.value)}
              />
            </Field>
            <Field label="Formule d accueil" className="md:col-span-2">
              <Textarea
                rows={2}
                value={form.welcome_message ?? ""}
                onChange={(event) => updateBranding("welcome_message", event.target.value)}
              />
            </Field>
            <Field label="Signature" className="md:col-span-2">
              <Textarea
                rows={2}
                value={form.support_signature ?? ""}
                onChange={(event) => updateBranding("support_signature", event.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => saveBranding(true)}>
              <RotateCcw data-icon="inline-start" />
              Restaurer GERIMMO
            </Button>
            <Button type="button" disabled={saving || !form.is_agency} onClick={() => saveBranding()}>
              <Save data-icon="inline-start" />
              Enregistrer l apparence
            </Button>
          </div>
        </section>

        <aside className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm">Aperçu dans le bot</div>
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
                <div className="text-muted-foreground text-xs">Assistance immobilière</div>
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
