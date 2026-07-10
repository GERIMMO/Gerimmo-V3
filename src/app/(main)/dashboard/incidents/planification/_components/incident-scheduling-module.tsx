"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, Eye, History, RotateCcw, Send, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { IncidentScheduleEvent, IncidentScheduleRequest, IncidentScheduleSlot, IncidentScheduleSlotBatch, ScheduleStatus } from "@/types/incident-scheduling";

const now = new Date("2026-07-10T10:00:00.000Z").toISOString();

const initialRequest: IncidentScheduleRequest = {
  id: "schedule-1",
  organization_id: "org-demo",
  incident_id: "incident-1",
  quote_request_id: "quote-request-1",
  comparison_id: "comparison-1",
  accepted_quote_id: "quote-accepted-1",
  quote_recipient_id: "recipient-1",
  artisan_profile_id: "artisan-1",
  responsible_profile_id: "responsable-1",
  tenant_profile_id: "locataire-1",
  requested_by: "responsable-1",
  status: "creneaux_proposes",
  current_round: 1,
  selected_slot_id: null,
  validated_at: null,
  future_links: { intervention: null, bot: null, notifications: null },
  metadata: {},
  created_at: now,
  updated_at: now,
  archived_at: null,
};

const initialBatch: IncidentScheduleSlotBatch = {
  id: "batch-1",
  organization_id: "org-demo",
  schedule_request_id: "schedule-1",
  proposed_by: "artisan-1",
  round_number: 1,
  status: "proposee",
  artisan_comment: "Disponibilites possibles cette semaine.",
  sent_at: now,
  created_at: now,
  updated_at: now,
  archived_at: null,
};

const initialSlots: IncidentScheduleSlot[] = [
  slot("slot-1", "batch-1", "2026-07-13T08:00:00.000Z", "2026-07-13T10:00:00.000Z", "Passage le matin"),
  slot("slot-2", "batch-1", "2026-07-14T12:30:00.000Z", "2026-07-14T14:00:00.000Z", "Equipe disponible apres midi"),
  slot("slot-3", "batch-1", "2026-07-15T07:30:00.000Z", "2026-07-15T09:00:00.000Z", "Creneau court"),
];

const statusLabels: Record<ScheduleStatus, string> = {
  demande_disponibilites: "Demande de disponibilites",
  creneaux_proposes: "Creneaux proposes",
  transmis_locataire: "Transmis au locataire",
  valide: "Creneau valide",
  relance_artisan: "Nouvelle demande artisan",
  annule: "Annule",
};

export function IncidentSchedulingModule() {
  const [request, setRequest] = useState(initialRequest);
  const [batches, setBatches] = useState([initialBatch]);
  const [slots, setSlots] = useState(initialSlots);
  const [events, setEvents] = useState<IncidentScheduleEvent[]>([
    event("event-1", "CREATE", "Demande de disponibilites creee."),
    event("event-2", "PROPOSITION_CRENEAUX", "3 creneaux proposes par l artisan."),
  ]);
  const [selectedSlotId, setSelectedSlotId] = useState(initialSlots[0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comment, setComment] = useState("");

  const activeBatch = useMemo(() => [...batches].sort((a, b) => b.round_number - a.round_number)[0], [batches]);
  const activeSlots = useMemo(() => slots.filter((item) => item.batch_id === activeBatch.id), [activeBatch.id, slots]);
  const selectedSlot = slots.find((item) => item.id === selectedSlotId) ?? activeSlots[0];

  function addEvent(action: string, eventComment?: string | null) {
    setEvents((current) => [event(crypto.randomUUID(), action, eventComment), ...current]);
  }

  function setStatus(status: ScheduleStatus, selectedId?: string | null) {
    setRequest((current) => ({
      ...current,
      status,
      selected_slot_id: selectedId ?? current.selected_slot_id,
      validated_at: status === "valide" ? new Date().toISOString() : current.validated_at,
      updated_at: new Date().toISOString(),
    }));
  }

  function transmitToTenant() {
    setBatches((current) => current.map((batch) => (batch.id === activeBatch.id ? { ...batch, status: "transmise" } : batch)));
    setStatus("transmis_locataire");
    addEvent("TRANSMISSION_LOCATAIRE", comment || "Creneaux transmis au locataire.");
  }

  function validateSlot(actor: "responsable" | "locataire") {
    setSlots((current) =>
      current.map((item) => (item.id === selectedSlot.id ? { ...item, status: "selectionne" } : item.batch_id === activeBatch.id ? { ...item, status: "refuse" } : item))
    );
    setBatches((current) => current.map((batch) => (batch.id === activeBatch.id ? { ...batch, status: "acceptee" } : batch)));
    setStatus("valide", selectedSlot.id);
    addEvent(actor === "responsable" ? "ACCEPTATION_DIRECTE" : "CHOIX_LOCATAIRE", comment || "Creneau valide.");
  }

  function rejectByTenant() {
    setSlots((current) => current.map((item) => (item.batch_id === activeBatch.id ? { ...item, status: "refuse" } : item)));
    setBatches((current) => current.map((batch) => (batch.id === activeBatch.id ? { ...batch, status: "refusee" } : batch)));
    setRequest((current) => ({ ...current, status: "relance_artisan", current_round: current.current_round + 1, selected_slot_id: null }));
    addEvent("REFUS_LOCATAIRE", comment || "Aucun de ces creneaux ne convient.");
  }

  function proposeNewRound() {
    const round = request.current_round;
    const batchId = `batch-${round}`;
    const nextSlots = [
      slot(`slot-${round}-1`, batchId, "2026-07-17T07:00:00.000Z", "2026-07-17T09:00:00.000Z", "Nouvelle proposition matin"),
      slot(`slot-${round}-2`, batchId, "2026-07-18T11:00:00.000Z", "2026-07-18T13:00:00.000Z", "Nouvelle proposition midi"),
      slot(`slot-${round}-3`, batchId, "2026-07-19T14:00:00.000Z", "2026-07-19T16:00:00.000Z", "Nouvelle proposition apres midi"),
    ];
    setBatches((current) => [{ ...initialBatch, id: batchId, round_number: round, status: "proposee", artisan_comment: "Nouvelle serie de disponibilites." }, ...current]);
    setSlots((current) => [...current, ...nextSlots]);
    setSelectedSlotId(nextSlots[0].id);
    setStatus("creneaux_proposes");
    addEvent("NOUVELLE_PROPOSITION", "Nouvelle serie de 3 creneaux recue.");
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-normal">Planification des interventions</h1>
          <p className="text-muted-foreground text-sm">Disponibilites artisan, validation responsable et choix locataire.</p>
        </div>
        <Badge variant="outline">{statusLabels[request.status]}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Tour actuel" value={request.current_round.toString()} />
        <Metric title="Creneaux actifs" value={activeSlots.length.toString()} />
        <Metric title="Artisan" value="Atelier Martin" />
        <Metric title="Validation" value={request.validated_at ? new Date(request.validated_at).toLocaleDateString("fr-FR") : "En attente"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4" />Calendrier des disponibilites</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Debut</TableHead><TableHead>Fin</TableHead><TableHead>Commentaire</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSlots.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{new Date(item.starts_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>{time(item.starts_at)}</TableCell>
                    <TableCell>{time(item.ends_at)}</TableCell>
                    <TableCell>{item.comment}</TableCell>
                    <TableCell><Badge variant={item.status === "selectionne" ? "default" : "outline"}>{item.status}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => { setSelectedSlotId(item.id); setDrawerOpen(true); addEvent("CONSULTATION_CRENEAU", "Creneau consulte."); }}><Eye className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="size-4" />Historique</CardTitle></CardHeader>
          <CardContent className="grid max-h-[430px] gap-2 overflow-y-auto">
            {events.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-medium">{item.action}</span><span className="text-muted-foreground text-xs">{new Date(item.created_at).toLocaleString("fr-FR")}</span></div>
                {item.comment ? <p className="mt-1 text-muted-foreground">{item.comment}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cycle de validation</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => validateSlot("responsable")} disabled={request.status === "valide"}><Check className="size-4" />Accepter directement</Button>
          <Button variant="outline" onClick={transmitToTenant} disabled={request.status === "valide"}><Send className="size-4" />Transmettre au locataire</Button>
          <Button variant="outline" onClick={rejectByTenant} disabled={request.status !== "transmis_locataire"}><X className="size-4" />Aucun de ces creneaux ne me convient</Button>
          <Button variant="outline" onClick={proposeNewRound} disabled={request.status !== "relance_artisan"}><RotateCcw className="size-4" />Nouvelle proposition artisan</Button>
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>Detail du creneau</SheetTitle></SheetHeader>
          <div className="mt-6 grid gap-5">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Date" value={new Date(selectedSlot.starts_at).toLocaleDateString("fr-FR")} />
              <Info label="Heure debut" value={time(selectedSlot.starts_at)} />
              <Info label="Heure fin" value={time(selectedSlot.ends_at)} />
              <Info label="Statut" value={selectedSlot.status} />
            </div>
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ajouter un commentaire de planification." />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => validateSlot("responsable")}><Check className="size-4" />Responsable valide</Button>
              <Button variant="outline" onClick={() => validateSlot("locataire")}><Check className="size-4" />Locataire choisit ce creneau</Button>
            </div>
            <div className="flex flex-wrap gap-2"><Badge variant="outline">Intervention: prete</Badge><Badge variant="outline">Bot: prepare</Badge><Badge variant="outline">Notifications: preparees</Badge></div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function slot(id: string, batchId: string, startsAt: string, endsAt: string, comment: string): IncidentScheduleSlot {
  return { id, organization_id: "org-demo", schedule_request_id: "schedule-1", batch_id: batchId, slot_date: startsAt.slice(0, 10), starts_at: startsAt, ends_at: endsAt, comment, status: "propose", created_at: now, updated_at: now, archived_at: null };
}

function event(id: string, action: string, comment?: string | null): IncidentScheduleEvent {
  return { id, organization_id: "org-demo", schedule_request_id: "schedule-1", batch_id: null, slot_id: null, response_id: null, actor_profile_id: "profile-1", action, comment: comment ?? null, old_values: null, new_values: null, metadata: {}, created_at: new Date().toISOString() };
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="font-semibold text-xl">{value}</CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-muted-foreground text-xs">{label}</p><p className="font-medium">{value}</p></div>;
}
