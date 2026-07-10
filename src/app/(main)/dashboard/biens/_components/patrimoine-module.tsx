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
import type { Bien, BienEcheance, BienHistorique, BienOccupant, Patrimoine, Residence, StatutBien, TypeBien } from "@/types/patrimoine";

const organizationId = "57b70a22-efb0-4d85-91dd-6a5a236ab145";
const now = new Date().toISOString();

const initialPatrimoines: Patrimoine[] = [{ id: "demo-patrimoine", organization_id: organizationId, name: "Patrimoine principal", reference: "PAT-001", description: "Base GERIMMO V3.", status: "active", archived_at: null }];
const initialResidences: Residence[] = [{ id: "demo-residence", organization_id: organizationId, patrimoine_id: "demo-patrimoine", name: "Residence Centre", reference: "RES-001", address_line1: "12 rue de la Paix", postal_code: "75002", city: "Paris", status: "active", archived_at: null }];
const initialBiens: Bien[] = [{ id: "demo-bien", organization_id: organizationId, patrimoine_id: "demo-patrimoine", residence_id: "demo-residence", reference: "B-001", name: "Appartement A12", type: "appartement", status: "occupe", address_line1: "12 rue de la Paix", postal_code: "75002", city: "Paris", floor: "1", surface_m2: 42, rooms: 2, monthly_rent_cents: 98000, monthly_charges_cents: 12000, created_at: now, updated_at: now, archived_at: null }];
const initialOccupants: BienOccupant[] = [{ id: "demo-occupant", bien_id: "demo-bien", full_name: "Dossier locataire a rattacher", occupant_type: "locataire", started_at: null, ended_at: null }];
const initialEcheances: BienEcheance[] = [{ id: "demo-echeance", bien_id: "demo-bien", title: "Revision annuelle", due_date: now.slice(0, 10), status: "a_prevoir", amount_cents: null }];
const initialHistorique: BienHistorique[] = [{ id: "demo-history", bien_id: "demo-bien", action: "CREATE", created_at: now }];

const statusLabels: Record<StatutBien, string> = { vacant: "Vacant", occupe: "Occupe", travaux: "Travaux", archive: "Archive" };
const typeLabels: Record<TypeBien, string> = { appartement: "Appartement", maison: "Maison", local: "Local", parking: "Parking", terrain: "Terrain", autre: "Autre" };

function centsToEuros(value: number) {
  return new Intl.NumberFormat("fr-FR", { currency: "EUR", style: "currency" }).format(value / 100);
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PatrimoineModule() {
  const [patrimoines, setPatrimoines] = useState(initialPatrimoines);
  const [residences, setResidences] = useState(initialResidences);
  const [biens, setBiens] = useState(initialBiens);
  const [historique, setHistorique] = useState(initialHistorique);
  const [selectedBienId, setSelectedBienId] = useState<string | null>(initialBiens[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatutBien | "tous">("tous");
  const [typeFilter, setTypeFilter] = useState<TypeBien | "tous">("tous");
  const selectedBien = biens.find((bien) => bien.id === selectedBienId) ?? null;
  const visibleBiens = useMemo(() => biens.filter((bien) => `${bien.reference} ${bien.name} ${bien.city ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === "tous" || bien.status === statusFilter) && (typeFilter === "tous" || bien.type === typeFilter)), [biens, query, statusFilter, typeFilter]);

  function addHistory(bienId: string, action: string) {
    setHistorique((items) => [{ id: createId("history"), bien_id: bienId, action, created_at: new Date().toISOString() }, ...items]);
  }

  function createPatrimoine() {
    setPatrimoines((items) => [...items, { id: createId("patrimoine"), organization_id: organizationId, name: `Patrimoine ${items.length + 1}`, reference: `PAT-${String(items.length + 1).padStart(3, "0")}`, description: null, status: "active", archived_at: null }]);
  }

  function createResidence() {
    const patrimoine = patrimoines[0];
    if (!patrimoine) return;
    setResidences((items) => [...items, { id: createId("residence"), organization_id: organizationId, patrimoine_id: patrimoine.id, name: `Residence ${items.length + 1}`, reference: `RES-${String(items.length + 1).padStart(3, "0")}`, address_line1: null, postal_code: null, city: null, status: "active", archived_at: null }]);
  }

  function createBien() {
    const patrimoine = patrimoines[0];
    if (!patrimoine) return;
    const next: Bien = { id: createId("bien"), organization_id: organizationId, patrimoine_id: patrimoine.id, residence_id: residences[0]?.id ?? null, reference: `B-${String(biens.length + 1).padStart(3, "0")}`, name: `Bien ${biens.length + 1}`, type: "appartement", status: "vacant", address_line1: null, postal_code: null, city: null, floor: null, surface_m2: null, rooms: null, monthly_rent_cents: 0, monthly_charges_cents: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), archived_at: null };
    setBiens((items) => [next, ...items]);
    setSelectedBienId(next.id);
    addHistory(next.id, "CREATE");
  }

  function updateSelectedBien(field: keyof Bien, value: Bien[keyof Bien]) {
    if (!selectedBien) return;
    setBiens((items) => items.map((bien) => (bien.id === selectedBien.id ? { ...bien, [field]: value, updated_at: new Date().toISOString() } : bien)));
    addHistory(selectedBien.id, "UPDATE");
  }

  function archiveSelectedBien() {
    if (!selectedBien) return;
    setBiens((items) => items.map((bien) => (bien.id === selectedBien.id ? { ...bien, status: "archive", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() } : bien)));
    addHistory(selectedBien.id, "ARCHIVE");
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Patrimoine</h1>
          <p className="text-muted-foreground text-sm">Gestion compacte des patrimoines, residences et biens.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={createPatrimoine}><Building2 />Patrimoine</Button>
          <Button size="sm" variant="outline" onClick={createResidence}><Home />Residence</Button>
          <Button size="sm" onClick={createBien}><Building2 />Bien</Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4"><Metric label="Patrimoines" value={patrimoines.length} /><Metric label="Residences" value={residences.length} /><Metric label="Biens actifs" value={biens.filter((item) => !item.archived_at).length} /><Metric label="Loyers mensuels" value={centsToEuros(biens.reduce((sum, bien) => sum + bien.monthly_rent_cents, 0))} /></div>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"><div className="relative min-w-56 flex-1"><Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 pl-8" placeholder="Rechercher un bien" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Filter value={statusFilter} values={statusLabels} label="Tous statuts" onChange={(value) => setStatusFilter(value as StatutBien | "tous")} /><Filter value={typeFilter} values={typeLabels} label="Tous types" onChange={(value) => setTypeFilter(value as TypeBien | "tous")} /></div>
      <div className="overflow-hidden rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Bien</TableHead><TableHead>Patrimoine</TableHead><TableHead>Residence</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Loyer</TableHead></TableRow></TableHeader><TableBody>{visibleBiens.map((bien) => <TableRow key={bien.id} className="cursor-pointer" onClick={() => setSelectedBienId(bien.id)}><TableCell className="font-medium">{bien.reference}</TableCell><TableCell>{bien.name}</TableCell><TableCell>{patrimoines.find((item) => item.id === bien.patrimoine_id)?.name ?? "-"}</TableCell><TableCell>{residences.find((item) => item.id === bien.residence_id)?.name ?? "Sans residence"}</TableCell><TableCell><Badge variant={bien.status === "archive" ? "outline" : "secondary"}>{statusLabels[bien.status]}</Badge></TableCell><TableCell className="text-right">{centsToEuros(bien.monthly_rent_cents)}</TableCell></TableRow>)}</TableBody></Table></div>
      <Sheet open={Boolean(selectedBien)} onOpenChange={(open) => !open && setSelectedBienId(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-3xl" side="right">{selectedBien ? <><SheetHeader><SheetTitle>{selectedBien.name}</SheetTitle><SheetDescription>Vue 360 du bien {selectedBien.reference} · {statusLabels[selectedBien.status]}</SheetDescription></SheetHeader><div className="grid gap-4 px-4 pb-4"><section className="grid gap-3 rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><h2 className="font-medium text-sm">Informations generales</h2><Button size="sm" variant="outline" onClick={archiveSelectedBien} disabled={selectedBien.status === "archive"}><Archive />Archiver</Button></div><div className="grid gap-3 md:grid-cols-3"><Field label="Nom" value={selectedBien.name} onChange={(value) => updateSelectedBien("name", value)} /><Field label="Reference" value={selectedBien.reference} onChange={(value) => updateSelectedBien("reference", value)} /><Field label="Ville" value={selectedBien.city ?? ""} onChange={(value) => updateSelectedBien("city", value)} /></div></section><Section icon={UserRound} title="Occupants" lines={initialOccupants.filter((item) => item.bien_id === selectedBien.id).map((item) => `${item.full_name} · ${item.occupant_type}`)} /><Section icon={FileText} title="Documents" lines={["Aucun document rattache pour le moment."]} /><Section icon={Wrench} title="Incidents" lines={["Aucun incident ouvert sur ce bien."]} /><Section icon={Wrench} title="Interventions" lines={["Aucune intervention planifiee."]} /><Section icon={FileText} title="Loyers" lines={[`Loyer mensuel: ${centsToEuros(selectedBien.monthly_rent_cents)}`]} /><Section icon={FileText} title="Charges" lines={[`Charges mensuelles: ${centsToEuros(selectedBien.monthly_charges_cents)}`]} /><Section icon={FileText} title="Rapports" lines={["Aucun rapport genere pour ce bien."]} /><Section icon={CalendarClock} title="Bloc Echeances" lines={initialEcheances.filter((item) => item.bien_id === selectedBien.id).map((item) => `${item.title} · ${item.due_date}`)} /><Section icon={History} title="Historique" lines={historique.filter((item) => item.bien_id === selectedBien.id).slice(0, 6).map((item) => `${item.action} · ${new Date(item.created_at).toLocaleString("fr-FR")}`)} /></div></> : null}</SheetContent></Sheet>
    </div>
  );
}

function Filter({ value, values, label, onChange }: Readonly<{ value: string; values: Record<string, string>; label: string; onChange: (value: string) => void }>) { return <Select value={value} onValueChange={onChange}><SelectTrigger className="h-8 min-w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tous">{label}</SelectItem>{Object.entries(values).map(([key, item]) => <SelectItem key={key} value={key}>{item}</SelectItem>)}</SelectContent></Select>; }
function Metric({ label, value }: Readonly<{ label: string; value: number | string }>) { return <div className="rounded-lg border bg-card p-3"><div className="text-muted-foreground text-xs">{label}</div><div className="font-semibold text-lg">{value}</div></div>; }
function Field({ label, value, onChange }: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) { return <div className="grid gap-1"><Label className="text-xs">{label}</Label><Input className="h-8" value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function Section({ icon: Icon, title, lines }: Readonly<{ icon: typeof FileText; title: string; lines: string[] }>) { return <section className="rounded-lg border p-3"><div className="mb-2 flex items-center gap-2 font-medium text-sm"><Icon className="size-4 text-muted-foreground" />{title}</div><div className="grid gap-1 text-sm">{lines.length ? lines.map((line) => <p key={line}>{line}</p>) : <p className="text-muted-foreground">Aucune donnee.</p>}</div></section>; }
