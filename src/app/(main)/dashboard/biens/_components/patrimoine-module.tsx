"use client";

import { useMemo, useState } from "react";

import { Archive, Building2, CalendarClock, FileText, History, Home, Search, UserRound, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [selectedBienId, setSelectedBienId] = useState<string | null>(initialPayload.biens[0]?.id ?? null);
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

  async function createPatrimoine() {
    const organizationId = patrimoines[0]?.organization_id ?? biens[0]?.organization_id;
    if (!organizationId) return;
    await createResource("patrimoine", {
      organization_id: organizationId,
      name: `Patrimoine ${patrimoines.length + 1}`,
      reference: `PAT-${String(patrimoines.length + 1).padStart(3, "0")}`,
    });
  }

  async function createResidence() {
    const patrimoine = patrimoines[0];
    if (!patrimoine) return;
    await createResource("residence", {
      organization_id: patrimoine.organization_id,
      patrimoine_id: patrimoine.id,
      name: `Résidence ${residences.length + 1}`,
      reference: `RES-${String(residences.length + 1).padStart(3, "0")}`,
    });
  }

  async function createBien() {
    const patrimoine = patrimoines[0];
    if (!patrimoine) return;
    await createResource("bien", {
      organization_id: patrimoine.organization_id,
      patrimoine_id: patrimoine.id,
      residence_id: residences[0]?.id ?? null,
      reference: `B-${String(biens.length + 1).padStart(3, "0")}`,
      name: `Bien ${biens.length + 1}`,
      type: "appartement",
      status: "vacant",
      monthly_rent_cents: 0,
      monthly_charges_cents: 0,
    });
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
          <Button size="sm" variant="outline" onClick={createPatrimoine}>
            <Building2 />
            Patrimoine
          </Button>
          <Button size="sm" variant="outline" onClick={createResidence}>
            <Home />
            Residence
          </Button>
          <Button size="sm" onClick={createBien}>
            <Building2 />
            Bien
          </Button>
        </div>
      </div>
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
                    <Field
                      label="Nom"
                      value={selectedBien.name}
                      onChange={(value) => updateSelectedBien("name", value)}
                    />
                    <Field
                      label="Reference"
                      value={selectedBien.reference}
                      onChange={(value) => updateSelectedBien("reference", value)}
                    />
                    <Field
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
        <SelectItem value="tous">{label}</SelectItem>
        {Object.entries(values).map(([key, item]) => (
          <SelectItem key={key} value={key}>
            {item}
          </SelectItem>
        ))}
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
function Field({
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
