"use client";

import { type FormEvent, useMemo, useState } from "react";

import { Archive, Building2, CalendarClock, FileText, History, Home, Search, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Bien, PatrimoinePayload, StatutBien, TypeBien } from "@/types/patrimoine";

const statusLabels: Record<StatutBien, string> = {
  vacant: "Vacant",
  occupe: "Occupe",
  travaux: "Travaux",
  archive: "Archive",
};
const typeLabels: Record<TypeBien, string> = {
  appartement: "Appartement",
  maison: "Maison",
  local: "Local",
  parking: "Parking",
  terrain: "Terrain",
  autre: "Autre",
};
const createTitles = {
  patrimoine: "Créer un patrimoine",
  residence: "Créer une résidence",
  bien: "Ajouter un bien",
};

function centsToEuros(value: number) {
  return new Intl.NumberFormat("fr-FR", { currency: "EUR", style: "currency" }).format(value / 100);
}

export function PatrimoineModule({ initialPayload }: { initialPayload: PatrimoinePayload }) {
  const [patrimoines, setPatrimoines] = useState(initialPayload.patrimoines);
  const [residences, setResidences] = useState(initialPayload.residences);
  const [biens, setBiens] = useState(initialPayload.biens);
  const [occupants, setOccupants] = useState(initialPayload.occupants);
  const [echeances, setEcheances] = useState(initialPayload.echeances);
  const [historique, setHistorique] = useState(initialPayload.historique);
  const [selectedBienId, setSelectedBienId] = useState<string | null>(initialPayload.biens.at(0)?.id ?? null);
  const [createMode, setCreateMode] = useState<"patrimoine" | "residence" | "bien" | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    reference: "",
    description: "",
    patrimoineId: "",
    residenceId: "",
    address: "",
    postalCode: "",
    city: "",
    type: "appartement" as TypeBien,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatutBien | "tous">("tous");
  const [typeFilter, setTypeFilter] = useState<TypeBien | "tous">("tous");
  const selectedBien = biens.find((bien) => bien.id === selectedBienId) ?? null;
  const visibleBiens = useMemo(
    () =>
      biens.filter(
        (bien) =>
          `${bien.reference} ${bien.name} ${bien.city ?? ""}`.toLowerCase().includes(query.toLowerCase()) &&
          (statusFilter === "tous" || bien.status === statusFilter) &&
          (typeFilter === "tous" || bien.type === typeFilter),
      ),
    [biens, query, statusFilter, typeFilter],
  );

  async function reload() {
    const response = await fetch("/api/patrimoine", { cache: "no-store" });
    if (!response.ok) throw new Error("Actualisation impossible.");
    const payload = (await response.json()) as PatrimoinePayload;
    setPatrimoines(payload.patrimoines);
    setResidences(payload.residences);
    setBiens(payload.biens);
    setOccupants(payload.occupants);
    setEcheances(payload.echeances);
    setHistorique(payload.historique);
  }

  async function createResource(type: "patrimoine" | "residence" | "bien", data: Record<string, unknown>) {
    const response = await fetch("/api/patrimoine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
    if (!response.ok) throw new Error("Création impossible.");
    const created = (await response.json()) as { id: string };
    await reload();
    if (type === "bien") setSelectedBienId(created.id);
  }

  function openCreate(mode: "patrimoine" | "residence" | "bien") {
    setForm((current) => ({
      ...current,
      name: "",
      reference: "",
      description: "",
      patrimoineId: patrimoines.at(0)?.id ?? "",
      residenceId: "",
      address: "",
      postalCode: "",
      city: "",
      type: "appartement",
    }));
    setCreateMode(mode);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createMode || !initialPayload.organizationId || !form.name.trim() || !form.reference.trim()) return;
    if (createMode !== "patrimoine" && !form.patrimoineId) return toast.error("Sélectionnez un patrimoine.");
    setCreating(true);
    const common = {
      organization_id: initialPayload.organizationId,
      name: form.name.trim(),
      reference: form.reference.trim(),
    };
    try {
      if (createMode === "patrimoine") {
        await createResource(createMode, { ...common, description: form.description.trim() || null });
      } else if (createMode === "residence") {
        await createResource(createMode, {
          ...common,
          patrimoine_id: form.patrimoineId,
          address_line1: form.address.trim() || null,
          postal_code: form.postalCode.trim() || null,
          city: form.city.trim() || null,
        });
      } else {
        await createResource(createMode, {
          ...common,
          patrimoine_id: form.patrimoineId,
          residence_id: form.residenceId || null,
          type: form.type,
          status: "vacant",
          address_line1: form.address.trim() || null,
          postal_code: form.postalCode.trim() || null,
          city: form.city.trim() || null,
          monthly_rent_cents: 0,
          monthly_charges_cents: 0,
        });
      }
      toast.success("Création enregistrée.");
      setCreateMode(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  }

  function updateSelectedBien(field: keyof Bien, value: Bien[keyof Bien]) {
    if (!selectedBien) return;
    setBiens((items) =>
      items.map((bien) =>
        bien.id === selectedBien.id ? { ...bien, [field]: value, updated_at: new Date().toISOString() } : bien,
      ),
    );
  }

  async function saveSelectedBien() {
    if (!selectedBien) return;
    const response = await fetch(`/api/patrimoine/${selectedBien.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selectedBien),
    });
    if (!response.ok) throw new Error("Enregistrement impossible.");
    await reload();
  }

  async function archiveSelectedBien() {
    if (!selectedBien) return;
    const response = await fetch(`/api/patrimoine/${selectedBien.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Archivage impossible.");
    await reload();
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Patrimoine</h1>
          <p className="text-muted-foreground text-sm">Gestion compacte des patrimoines, residences et biens.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openCreate("patrimoine")}
            disabled={!initialPayload.organizationId}
          >
            <Building2 />
            Patrimoine
          </Button>
          <Button size="sm" variant="outline" onClick={() => openCreate("residence")} disabled={!patrimoines.length}>
            <Home />
            Residence
          </Button>
          <Button size="sm" onClick={() => openCreate("bien")} disabled={!patrimoines.length}>
            <Building2 />
            Bien
          </Button>
        </div>
      </div>
      <Sheet open={Boolean(createMode)} onOpenChange={(open) => !open && setCreateMode(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <form className="flex min-h-full flex-col" onSubmit={submitCreate}>
            <SheetHeader>
              <SheetTitle>{createMode ? createTitles[createMode] : "Créer"}</SheetTitle>
              <SheetDescription>Renseignez les informations réelles avant la création.</SheetDescription>
            </SheetHeader>
            <FieldGroup className="px-4 py-2">
              <Field>
                <FieldLabel htmlFor="resource-name">Nom</FieldLabel>
                <Input
                  id="resource-name"
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="resource-reference">Référence</FieldLabel>
                <Input
                  id="resource-reference"
                  required
                  value={form.reference}
                  onChange={(event) => setForm({ ...form, reference: event.target.value })}
                />
              </Field>
              {createMode === "patrimoine" ? (
                <Field>
                  <FieldLabel htmlFor="resource-description">Description</FieldLabel>
                  <Textarea
                    id="resource-description"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                  />
                </Field>
              ) : (
                <>
                  <Field>
                    <FieldLabel>Patrimoine</FieldLabel>
                    <Select
                      value={form.patrimoineId}
                      onValueChange={(value) => setForm({ ...form, patrimoineId: value, residenceId: "" })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisir un patrimoine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {patrimoines.map((patrimoine) => (
                            <SelectItem key={patrimoine.id} value={patrimoine.id}>
                              {patrimoine.reference} · {patrimoine.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  {createMode === "bien" ? (
                    <>
                      <Field>
                        <FieldLabel>Résidence</FieldLabel>
                        <Select
                          value={form.residenceId || "none"}
                          onValueChange={(value) => setForm({ ...form, residenceId: value === "none" ? "" : value })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">Sans résidence</SelectItem>
                              {residences
                                .filter((residence) => residence.patrimoine_id === form.patrimoineId)
                                .map((residence) => (
                                  <SelectItem key={residence.id} value={residence.id}>
                                    {residence.reference} · {residence.name}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Type de bien</FieldLabel>
                        <Select
                          value={form.type}
                          onValueChange={(value) => setForm({ ...form, type: value as TypeBien })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.entries(typeLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </>
                  ) : null}
                  <Field>
                    <FieldLabel htmlFor="resource-address">Adresse</FieldLabel>
                    <Input
                      id="resource-address"
                      value={form.address}
                      onChange={(event) => setForm({ ...form, address: event.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="resource-postal-code">Code postal</FieldLabel>
                      <Input
                        id="resource-postal-code"
                        value={form.postalCode}
                        onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="resource-city">Ville</FieldLabel>
                      <Input
                        id="resource-city"
                        value={form.city}
                        onChange={(event) => setForm({ ...form, city: event.target.value })}
                      />
                    </Field>
                  </div>
                </>
              )}
            </FieldGroup>
            <SheetFooter>
              <Button type="submit" disabled={creating || !form.name.trim() || !form.reference.trim()}>
                {creating ? "Création en cours" : "Créer"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Patrimoines" value={patrimoines.length} />
        <Metric label="Residences" value={residences.length} />
        <Metric label="Biens actifs" value={biens.filter((item) => !item.archived_at).length} />
        <Metric
          label="Loyers mensuels"
          value={centsToEuros(biens.reduce((sum, bien) => sum + bien.monthly_rent_cents, 0))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Rechercher un bien"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Filter
          value={statusFilter}
          values={statusLabels}
          label="Tous statuts"
          onChange={(value) => setStatusFilter(value as StatutBien | "tous")}
        />
        <Filter
          value={typeFilter}
          values={typeLabels}
          label="Tous types"
          onChange={(value) => setTypeFilter(value as TypeBien | "tous")}
        />
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Bien</TableHead>
              <TableHead>Patrimoine</TableHead>
              <TableHead>Residence</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Loyer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleBiens.map((bien) => (
              <TableRow key={bien.id} className="cursor-pointer" onClick={() => setSelectedBienId(bien.id)}>
                <TableCell className="font-medium">{bien.reference}</TableCell>
                <TableCell>{bien.name}</TableCell>
                <TableCell>{patrimoines.find((item) => item.id === bien.patrimoine_id)?.name ?? "-"}</TableCell>
                <TableCell>
                  {residences.find((item) => item.id === bien.residence_id)?.name ?? "Sans residence"}
                </TableCell>
                <TableCell>
                  <Badge variant={bien.status === "archive" ? "outline" : "secondary"}>
                    {statusLabels[bien.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{centsToEuros(bien.monthly_rent_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet open={Boolean(selectedBien)} onOpenChange={(open) => !open && setSelectedBienId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" side="right">
          {selectedBien ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedBien.name}</SheetTitle>
                <SheetDescription>
                  Vue 360 du bien {selectedBien.reference} · {statusLabels[selectedBien.status]}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 px-4 pb-4">
                <section className="grid gap-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-medium text-sm">Informations générales</h2>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveSelectedBien}>
                        Enregistrer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={archiveSelectedBien}
                        disabled={selectedBien.status === "archive"}
                      >
                        <Archive />
                        Archiver
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <EditableField
                      label="Nom"
                      value={selectedBien.name}
                      onChange={(value) => updateSelectedBien("name", value)}
                    />
                    <EditableField
                      label="Reference"
                      value={selectedBien.reference}
                      onChange={(value) => updateSelectedBien("reference", value)}
                    />
                    <EditableField
                      label="Ville"
                      value={selectedBien.city ?? ""}
                      onChange={(value) => updateSelectedBien("city", value)}
                    />
                  </div>
                </section>
                <Section
                  icon={UserRound}
                  title="Occupants"
                  lines={occupants
                    .filter((item) => item.bien_id === selectedBien.id)
                    .map((item) => `${item.full_name} · ${item.occupant_type}`)}
                />
                <Section icon={FileText} title="Documents" lines={["Aucun document rattache pour le moment."]} />
                <Section icon={Wrench} title="Incidents" lines={["Aucun incident ouvert sur ce bien."]} />
                <Section icon={Wrench} title="Interventions" lines={["Aucune intervention planifiee."]} />
                <Section
                  icon={FileText}
                  title="Loyers"
                  lines={[`Loyer mensuel: ${centsToEuros(selectedBien.monthly_rent_cents)}`]}
                />
                <Section
                  icon={FileText}
                  title="Charges"
                  lines={[`Charges mensuelles: ${centsToEuros(selectedBien.monthly_charges_cents)}`]}
                />
                <Section icon={FileText} title="Rapports" lines={["Aucun rapport genere pour ce bien."]} />
                <Section
                  icon={CalendarClock}
                  title="Bloc Echeances"
                  lines={echeances
                    .filter((item) => item.bien_id === selectedBien.id)
                    .map((item) => `${item.title} · ${item.due_date}`)}
                />
                <Section
                  icon={History}
                  title="Historique"
                  lines={historique
                    .filter((item) => item.bien_id === selectedBien.id)
                    .slice(0, 6)
                    .map((item) => `${item.action} · ${new Date(item.created_at).toLocaleString("fr-FR")}`)}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Filter({
  value,
  values,
  label,
  onChange,
}: Readonly<{ value: string; values: Record<string, string>; label: string; onChange: (value: string) => void }>) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="tous">{label}</SelectItem>
          {Object.entries(values).map(([key, item]) => (
            <SelectItem key={key} value={key}>
              {item}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
function Metric({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}
function EditableField({
  label,
  value,
  onChange,
}: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-8" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
function Section({ icon: Icon, title, lines }: Readonly<{ icon: typeof FileText; title: string; lines: string[] }>) {
  return (
    <section className="rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2 font-medium text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </div>
      <div className="grid gap-1 text-sm">
        {lines.length ? (
          lines.map((line) => <p key={line}>{line}</p>)
        ) : (
          <p className="text-muted-foreground">Aucune donnee.</p>
        )}
      </div>
    </section>
  );
}
