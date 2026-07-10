"use client";

import { useMemo, useState } from "react";
import { Archive, Eye, History, Image, Pencil, Plus, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { GerimmoIncident, IncidentCategory, IncidentEvent, IncidentPhoto, IncidentPriority, IncidentStatus } from "@/types/incidents";

const now = new Date().toISOString();
const futureLinks = { devis: [], interventions: [], rapports: [], bot: null };

const categories: IncidentCategory[] = [
  { id: "cat-1", organization_id: null, name: "Plomberie", slug: "plomberie", description: null, is_official: true, sort_order: 10, archived_at: null },
  { id: "cat-2", organization_id: null, name: "Electricite", slug: "electricite", description: null, is_official: true, sort_order: 20, archived_at: null },
  { id: "cat-3", organization_id: null, name: "Chauffage", slug: "chauffage", description: null, is_official: true, sort_order: 30, archived_at: null },
  { id: "cat-4", organization_id: null, name: "Serrurerie", slug: "serrurerie", description: null, is_official: true, sort_order: 40, archived_at: null },
  { id: "cat-5", organization_id: null, name: "Parties communes", slug: "parties-communes", description: null, is_official: true, sort_order: 50, archived_at: null },
  { id: "cat-6", organization_id: null, name: "Administratif", slug: "administratif", description: null, is_official: true, sort_order: 60, archived_at: null },
];

const biens = [
  { id: "bien-1", label: "A-102 - Residence Victor Hugo" },
  { id: "bien-2", label: "B-014 - Les Jardins Nord" },
  { id: "bien-3", label: "P-07 - Parking Centre" },
];

const responsables = [
  { id: "profile-1", label: "Sophie Martin" },
  { id: "profile-2", label: "Karim Benali" },
  { id: "profile-3", label: "Aline Robert" },
];

const initialIncidents: GerimmoIncident[] = [
  {
    id: "inc-1",
    number: "INC-2026-000001",
    organization_id: "org-demo",
    bien_id: "bien-1",
    created_by: "profile-1",
    responsible_profile_id: "profile-2",
    category_id: "cat-1",
    category: "Plomberie",
    subcategory: "Fuite",
    description: "Fuite signalee sous l evier de la cuisine.",
    priority: "haute",
    status: "nouveau",
    photos: [{ name: "fuite-cuisine.jpg", size_bytes: 420000, mime_type: "image/jpeg" }],
    future_links: futureLinks,
    metadata: { source: "agence" },
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "inc-2",
    number: "INC-2026-000002",
    organization_id: "org-demo",
    bien_id: "bien-2",
    created_by: "profile-2",
    responsible_profile_id: "profile-3",
    category_id: "cat-2",
    category: "Electricite",
    subcategory: "Eclairage",
    description: "Eclairage du palier intermittent.",
    priority: "normale",
    status: "en_cours",
    photos: [],
    future_links: futureLinks,
    metadata: { source: "locataire" },
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
];

const initialEvents: IncidentEvent[] = [
  { id: "evt-1", organization_id: "org-demo", incident_id: "inc-2", actor_profile_id: "profile-2", action: "UPDATE", old_values: null, new_values: null, metadata: {}, created_at: now },
  { id: "evt-2", organization_id: "org-demo", incident_id: "inc-1", actor_profile_id: "profile-1", action: "CREATE", old_values: null, new_values: null, metadata: {}, created_at: now },
];

const priorityLabels: Record<IncidentPriority, string> = { basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente" };
const statusLabels: Record<IncidentStatus, string> = { nouveau: "Nouveau", en_cours: "En cours", cloture: "Cloture", archive: "Archive" };
const priorityClassName: Record<IncidentPriority, string> = {
  basse: "border-slate-200 bg-slate-50 text-slate-700",
  normale: "border-blue-200 bg-blue-50 text-blue-700",
  haute: "border-amber-200 bg-amber-50 text-amber-700",
  urgente: "border-red-200 bg-red-50 text-red-700",
};

type IncidentForm = {
  bien_id: string;
  responsible_profile_id: string;
  category_id: string;
  subcategory: string;
  description: string;
  priority: IncidentPriority;
  photos: IncidentPhoto[];
};

const emptyForm: IncidentForm = {
  bien_id: biens[0].id,
  responsible_profile_id: responsables[0].id,
  category_id: categories[0].id,
  subcategory: "",
  description: "",
  priority: "normale",
  photos: [],
};

function bienLabel(id: string) {
  return biens.find((bien) => bien.id === id)?.label ?? "Bien non renseigne";
}

function profileLabel(id: string | null) {
  return responsables.find((responsable) => responsable.id === id)?.label ?? "Non assigne";
}

function nextNumber(count: number) {
  return `INC-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
}

export function IncidentsModule() {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [events, setEvents] = useState(initialEvents);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [priorityFilter, setPriorityFilter] = useState("toutes");
  const [selectedId, setSelectedId] = useState(initialIncidents[0].id);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const selectedIncident = incidents.find((incident) => incident.id === selectedId) ?? null;
  const selectedEvents = events.filter((event) => event.incident_id === selectedIncident?.id);
  const filteredIncidents = useMemo(
    () =>
      incidents.filter((incident) => {
        const text = `${incident.number} ${incident.category} ${incident.subcategory ?? ""} ${incident.description} ${bienLabel(incident.bien_id)}`.toLowerCase();
        return (
          text.includes(query.toLowerCase()) &&
          (statusFilter === "tous" || incident.status === statusFilter) &&
          (priorityFilter === "toutes" || incident.priority === priorityFilter)
        );
      }),
    [incidents, priorityFilter, query, statusFilter]
  );

  function addEvent(incidentId: string, action: string) {
    setEvents((current) => [{ id: crypto.randomUUID(), organization_id: "org-demo", incident_id: incidentId, actor_profile_id: "profile-1", action, old_values: null, new_values: null, metadata: {}, created_at: new Date().toISOString() }, ...current]);
  }

  function createIncident() {
    const category = categories.find((item) => item.id === form.category_id) ?? categories[0];
    const createdAt = new Date().toISOString();
    const incident: GerimmoIncident = {
      id: crypto.randomUUID(),
      number: nextNumber(incidents.length),
      organization_id: "org-demo",
      bien_id: form.bien_id,
      created_by: "profile-1",
      responsible_profile_id: form.responsible_profile_id,
      category_id: category.id,
      category: category.name,
      subcategory: form.subcategory || null,
      description: form.description,
      priority: form.priority,
      status: "nouveau",
      photos: form.photos,
      future_links: futureLinks,
      metadata: { rattachements_futurs: ["devis", "interventions", "rapports", "bot"] },
      created_at: createdAt,
      updated_at: createdAt,
      archived_at: null,
    };
    setIncidents((current) => [incident, ...current]);
    setEvents((current) => [{ id: crypto.randomUUID(), organization_id: "org-demo", incident_id: incident.id, actor_profile_id: "profile-1", action: "CREATE", old_values: null, new_values: null, metadata: {}, created_at: createdAt }, ...current]);
    setSelectedId(incident.id);
    setForm(emptyForm);
    setCreateOpen(false);
    setDetailsOpen(true);
  }

  function updateSelected(patch: Partial<GerimmoIncident>, action = "UPDATE") {
    if (!selectedIncident) {
      return;
    }
    setIncidents((current) => current.map((incident) => (incident.id === selectedIncident.id ? { ...incident, ...patch, updated_at: new Date().toISOString() } : incident)));
    addEvent(selectedIncident.id, action);
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-normal">Incidents</h1>
          <p className="text-muted-foreground text-sm">Creation et suivi initial des incidents GERIMMO.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Nouvel incident
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Total", incidents.length],
          ["Nouveaux", incidents.filter((incident) => incident.status === "nouveau").length],
          ["Urgents", incidents.filter((incident) => incident.priority === "urgente").length],
          ["Archives", incidents.filter((incident) => incident.status === "archive").length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent className="font-semibold text-2xl">{value}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Tableau des incidents</CardTitle>
            <Badge variant="outline">
              <ShieldCheck className="mr-1 size-3" />
              RLS prepare
            </Badge>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Rechercher un numero, bien, categorie..." />
            </div>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="tous">Tous les statuts</option>
              <option value="nouveau">Nouveau</option>
              <option value="en_cours">En cours</option>
              <option value="archive">Archive</option>
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="toutes">Toutes priorites</option>
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {["Numero", "Bien", "Categorie", "Priorite", "Statut", "Responsable", "Action"].map((head) => (
                  <TableHead key={head} className={head === "Action" ? "text-right" : undefined}>
                    {head}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-medium">{incident.number}</TableCell>
                  <TableCell>{bienLabel(incident.bien_id)}</TableCell>
                  <TableCell>{incident.category}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityClassName[incident.priority]}>
                      {priorityLabels[incident.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>{statusLabels[incident.status]}</TableCell>
                  <TableCell>{profileLabel(incident.responsible_profile_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedId(incident.id);
                        setDetailsOpen(true);
                      }}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Creer un incident</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-4">
            <IncidentFormFields form={form} onChange={setForm} />
            <Button disabled={!form.description.trim()} onClick={createIncident}>
              <Plus className="size-4" />
              Creer l incident
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedIncident ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedIncident.number}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-5">
                <IncidentDetails incident={selectedIncident} editing={editing} events={selectedEvents} onUpdate={updateSelected} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setEditing((current) => !current)}>
                    <Pencil className="size-4" />
                    Modifier
                  </Button>
                  <Button variant="outline" onClick={() => updateSelected({ status: "archive", archived_at: new Date().toISOString() }, "ARCHIVE")}>
                    <Archive className="size-4" />
                    Archiver
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function IncidentFormFields({ form, onChange }: { form: IncidentForm; onChange: (form: IncidentForm) => void }) {
  return (
    <>
      <SelectField label="Bien" value={form.bien_id} options={biens} onChange={(bienId) => onChange({ ...form, bien_id: bienId })} />
      <SelectField label="Responsable" value={form.responsible_profile_id} options={responsables} onChange={(profileId) => onChange({ ...form, responsible_profile_id: profileId })} />
      <SelectField label="Categorie" value={form.category_id} options={categories.map((category) => ({ id: category.id, label: category.name }))} onChange={(categoryId) => onChange({ ...form, category_id: categoryId })} />
      <label className="grid gap-2 text-sm" htmlFor="incident-subcategory">
        Sous-categorie
        <Input id="incident-subcategory" value={form.subcategory} onChange={(event) => onChange({ ...form, subcategory: event.target.value })} placeholder="Ex: Fuite, panne, acces..." />
      </label>
      <label className="grid gap-2 text-sm">
        Priorite
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value as IncidentPriority })}>
          <option value="basse">Basse</option>
          <option value="normale">Normale</option>
          <option value="haute">Haute</option>
          <option value="urgente">Urgente</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm" htmlFor="incident-description">
        Description
        <Textarea id="incident-description" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} placeholder="Decrire clairement le probleme constate." />
      </label>
      <label className="grid gap-2 text-sm" htmlFor="incident-photos">
        Photos
        <Input
          id="incident-photos"
          type="file"
          multiple
          accept="image/*"
          onChange={(event) => onChange({ ...form, photos: Array.from(event.target.files ?? []).map((file) => ({ name: file.name, size_bytes: file.size, mime_type: file.type })) })}
        />
      </label>
    </>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      {label}
      <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function IncidentDetails({ incident, editing, events, onUpdate }: { incident: GerimmoIncident; editing: boolean; events: IncidentEvent[]; onUpdate: (patch: Partial<GerimmoIncident>, action?: string) => void }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Bien", bienLabel(incident.bien_id)],
          ["Responsable", profileLabel(incident.responsible_profile_id)],
          ["Categorie", incident.category],
          ["Sous-categorie", incident.subcategory ?? "Non renseignee"],
          ["Statut", statusLabels[incident.status]],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="font-medium">{value}</p>
          </div>
        ))}
        <div>
          <p className="text-muted-foreground text-xs">Priorite</p>
          <Badge variant="outline" className={priorityClassName[incident.priority]}>
            {priorityLabels[incident.priority]}
          </Badge>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Description</p>
        {editing ? <Textarea value={incident.description} onChange={(event) => onUpdate({ description: event.target.value })} /> : <p className="mt-1 text-sm">{incident.description}</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="Statut" value={incident.status} options={[{ id: "nouveau", label: "Nouveau" }, { id: "en_cours", label: "En cours" }, { id: "archive", label: "Archive" }]} onChange={(status) => onUpdate({ status: status as IncidentStatus })} />
        <SelectField label="Priorite" value={incident.priority} options={[{ id: "basse", label: "Basse" }, { id: "normale", label: "Normale" }, { id: "haute", label: "Haute" }, { id: "urgente", label: "Urgente" }]} onChange={(priority) => onUpdate({ priority: priority as IncidentPriority })} />
      </div>
      <InfoBlock icon={<Image className="size-4" />} title="Photos">
        {incident.photos.length ? incident.photos.map((photo) => <Row key={photo.name} left={photo.name} right={photo.mime_type ?? "image"} />) : <p className="text-muted-foreground text-sm">Aucune photo rattachee.</p>}
      </InfoBlock>
      <InfoBlock icon={<SlidersHorizontal className="size-4" />} title="Rattachements futurs prepares">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Badge variant="outline">Devis: {incident.future_links.devis.length}</Badge>
          <Badge variant="outline">Interventions: {incident.future_links.interventions.length}</Badge>
          <Badge variant="outline">Rapports: {incident.future_links.rapports.length}</Badge>
          <Badge variant="outline">Bot: pret</Badge>
        </div>
      </InfoBlock>
      <InfoBlock icon={<History className="size-4" />} title="Historique">
        {events.map((event) => (
          <Row key={event.id} left={event.action} right={new Date(event.created_at).toLocaleString("fr-FR")} />
        ))}
      </InfoBlock>
    </>
  );
}

function InfoBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="font-medium text-sm">{title}</p>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <span className="font-medium">{left}</span>
      <span className="text-muted-foreground">{right}</span>
    </div>
  );
}
