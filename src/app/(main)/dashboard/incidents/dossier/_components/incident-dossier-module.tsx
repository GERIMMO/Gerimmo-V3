"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Eye, FileText, History, Play, RotateCcw, Star, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ArtisanEvaluation, IncidentIntervention, InterventionReport, InterventionStatus } from "@/types/incident-finalization";

const now = new Date("2026-07-10T10:00:00.000Z").toISOString();

const statusLabels: Record<InterventionStatus, string> = {
  planifiee: "Planifiee",
  confirmee: "Confirmee",
  en_cours: "En cours",
  suspendue: "Suspendue",
  terminee: "Terminee",
  annulee: "Annulee",
  a_reprogrammer: "A reprogrammer",
};

const initialIntervention: IncidentIntervention = {
  id: "intervention-1",
  organization_id: "org-demo",
  incident_id: "inc-1",
  bien_id: "bien-1",
  schedule_request_id: "schedule-1",
  selected_slot_id: "slot-1",
  accepted_quote_id: "quote-1",
  quote_recipient_id: "recipient-1",
  artisan_profile_id: "artisan-1",
  internal_intervenant_profile_id: null,
  responsible_profile_id: "profile-1",
  tenant_profile_id: "tenant-1",
  execution_mode: "artisan_gerimmo",
  planned_starts_at: "2026-07-13T08:00:00.000Z",
  planned_ends_at: "2026-07-13T10:00:00.000Z",
  actual_starts_at: null,
  actual_ends_at: null,
  status: "planifiee",
  work_description: "Remplacement du siphon et controle de l etancheite.",
  artisan_comment: null,
  responsible_comment: null,
  photos_before: [{ name: "avant-fuite.jpg", mime_type: "image/jpeg", size_bytes: 420000 }],
  photos_during: [],
  photos_after: [],
  planned_amount_cents: 125000,
  final_amount_cents: null,
  amount_difference_cents: null,
  difference_reason: null,
  completion_validation: {},
  future_links: { rapport: null, bot: null, notifications: null },
  metadata: { mode: "artisan GERIMMO" },
  created_by: "profile-1",
  created_at: now,
  updated_at: now,
  archived_at: null,
};

export function IncidentDossierModule() {
  const [intervention, setIntervention] = useState(initialIntervention);
  const [report, setReport] = useState<InterventionReport | null>(null);
  const [evaluations, setEvaluations] = useState<ArtisanEvaluation[]>([]);
  const [events, setEvents] = useState([
    { id: "timeline-1", label: "Incident cree", created_at: now },
    { id: "timeline-2", label: "Deux devis recus", created_at: now },
    { id: "timeline-3", label: "Devis recommande puis retenu", created_at: now },
    { id: "timeline-4", label: "Rendez-vous confirme", created_at: now },
  ]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comment, setComment] = useState("");
  const averageRating = useMemo(() => {
    if (evaluations.length === 0) {
      return null;
    }
    return evaluations.reduce((sum, item) => sum + item.average_rating, 0) / evaluations.length;
  }, [evaluations]);

  function addEvent(label: string) {
    setEvents((current) => [timeline(label), ...current]);
  }

  function setInterventionStatus(status: InterventionStatus) {
    setIntervention((current) => ({
      ...current,
      status,
      actual_starts_at: status === "en_cours" ? (current.actual_starts_at ?? new Date().toISOString()) : current.actual_starts_at,
      actual_ends_at: status === "terminee" ? new Date().toISOString() : current.actual_ends_at,
      final_amount_cents: status === "terminee" ? 125000 : current.final_amount_cents,
      completion_validation: status === "terminee" ? { artisan: true, commentaire: comment } : current.completion_validation,
      photos_after: status === "terminee" ? [{ name: "apres-reparation.jpg", mime_type: "image/jpeg", size_bytes: 390000 }] : current.photos_after,
      updated_at: new Date().toISOString(),
    }));
    addEvent(`Intervention ${statusLabels[status].toLowerCase()}`);
  }

  function generateReport() {
    const generated: InterventionReport = {
      id: "rapport-1",
      organization_id: intervention.organization_id,
      incident_id: intervention.incident_id,
      intervention_id: intervention.id,
      document_id: "document-rapport-1",
      report_reference: "RAP-2026-000001",
      status: "genere",
      report_data: { intervention, sections: ["contexte", "travaux", "photos", "montants", "chronologie"] },
      observations: comment || null,
      validation_comment: null,
      generated_at: new Date().toISOString(),
      validated_at: null,
      validated_by: null,
      downloaded_at: null,
      printed_at: null,
      email_prepared_at: null,
      pdf_storage_path: "rapports-incidents/org-demo/RAP-2026-000001.pdf",
      pdf_file_name: "RAP-2026-000001.pdf",
      pdf_checksum: null,
      metadata: { archive_documents: true },
      created_by: "profile-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    };
    setReport(generated);
    addEvent("Rapport PDF genere et rattache aux documents");
  }

  function validateReport() {
    setReport((current) =>
      current ? { ...current, status: "valide", validated_at: new Date().toISOString(), validated_by: "profile-1", validation_comment: comment || null } : current
    );
    addEvent("Rapport valide par le responsable");
  }

  function closeIncident(withReserve: boolean) {
    addEvent(withReserve ? "Incident cloture avec reserve" : "Incident cloture");
  }

  function addEvaluation(role: "locataire" | "responsable") {
    if (evaluations.some((item) => item.evaluator_role === role)) {
      addEvent(`Seconde evaluation ${role} bloquee`);
      return;
    }
    const rating = role === "locataire" ? 4.6 : 4.8;
    setEvaluations((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        organization_id: intervention.organization_id,
        incident_id: intervention.incident_id,
        intervention_id: intervention.id,
        artisan_profile_id: intervention.artisan_profile_id,
        evaluator_profile_id: role === "locataire" ? "tenant-1" : "profile-1",
        evaluator_role: role,
        work_quality: role === "locataire" ? 4 : 5,
        appointment_respect: 5,
        communication: 5,
        cleanliness: 4,
        overall_rating: 5,
        average_rating: rating,
        comment: comment || null,
        flagged: false,
        flag_reason: null,
        created_at: new Date().toISOString(),
        archived_at: null,
      },
    ]);
    addEvent(`Evaluation ${role} enregistree`);
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-normal">Dossier incident complet</h1>
          <p className="text-muted-foreground text-sm">Incident, devis, planification, intervention, rapport, cloture et evaluations.</p>
        </div>
        <Badge variant="outline">Chronologie unique</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Incident" value="INC-2026-000001" />
        <Metric title="Intervention" value={statusLabels[intervention.status]} />
        <Metric title="Rapport" value={report?.status ?? "A generer"} />
        <Metric title="Note artisan" value={averageRating ? `${averageRating.toFixed(1)}/5` : "En attente"} />
      </div>

      <Tabs defaultValue="intervention">
        <TabsList>
          <TabsTrigger value="intervention">Intervention</TabsTrigger>
          <TabsTrigger value="rapport">Rapport</TabsTrigger>
          <TabsTrigger value="cloture">Cloture</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="intervention" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Suivi d intervention</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Info label="Mode" value="Artisan GERIMMO" />
                <Info label="Creneau confirme" value={`${date(intervention.planned_starts_at)} ${time(intervention.planned_starts_at)}-${time(intervention.planned_ends_at)}`} />
                <Info label="Montant prevu" value={money(intervention.planned_amount_cents)} />
              </div>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Commentaire de suivi." />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setInterventionStatus("en_cours")}><Play className="size-4" />Demarrer</Button>
                <Button variant="outline" onClick={() => setInterventionStatus("suspendue")}><X className="size-4" />Suspendre</Button>
                <Button variant="outline" onClick={() => setInterventionStatus("en_cours")}><RotateCcw className="size-4" />Reprendre</Button>
                <Button variant="outline" onClick={() => setInterventionStatus("terminee")}><Check className="size-4" />Terminer</Button>
                <Button variant="ghost" onClick={() => setDrawerOpen(true)}><Eye className="size-4" />Ouvrir le suivi</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rapport" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Rapport officiel GERIMMO</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-muted-foreground text-sm">Le rapport est rattache a la bibliotheque documentaire, au bien, a l incident et a l intervention.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={generateReport}><FileText className="size-4" />Generer le PDF</Button>
                <Button variant="outline" onClick={validateReport} disabled={!report}><ClipboardCheck className="size-4" />Valider le rapport</Button>
                <Button variant="outline" disabled={!report}>Telechargement prepare</Button>
                <Button variant="outline" disabled={!report}>Impression preparee</Button>
              </div>
              {report ? <Info label="Reference" value={report.report_reference} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cloture" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cloture et evaluations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => closeIncident(false)} disabled={intervention.status !== "terminee" || report?.status !== "valide"}><Check className="size-4" />Cloturer</Button>
                <Button variant="outline" onClick={() => closeIncident(true)} disabled={intervention.status !== "terminee" || report?.status !== "valide"}>Cloturer avec reserve</Button>
                <Button variant="outline" onClick={() => addEvaluation("locataire")}><Star className="size-4" />Evaluation locataire</Button>
                <Button variant="outline" onClick={() => addEvaluation("responsable")}><Star className="size-4" />Evaluation responsable</Button>
              </div>
              <EvaluationsTable evaluations={evaluations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historique" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="size-4" />Chronologie</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {events.map((event) => (
                <div key={event.id} className="flex justify-between rounded-md border border-border p-3 text-sm">
                  <span className="font-medium">{event.label}</span>
                  <span className="text-muted-foreground">{new Date(event.created_at).toLocaleString("fr-FR")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Suivi detaille</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 p-4">
            <Info label="Travaux" value={intervention.work_description ?? "Non renseigne"} />
            <Info label="Photos avant" value={intervention.photos_before.length.toString()} />
            <Info label="Photos apres" value={intervention.photos_after.length.toString()} />
            <Info label="Montant final" value={intervention.final_amount_cents ? money(intervention.final_amount_cents) : "En attente"} />
            <Badge variant="outline">Raccordements futurs bot et notifications prepares</Badge>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function timeline(label: string) {
  return { id: crypto.randomUUID(), label, created_at: new Date().toISOString() };
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="font-semibold text-xl">{value}</CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-muted-foreground text-xs">{label}</p><p className="font-medium">{value}</p></div>;
}

function EvaluationsTable({ evaluations }: { evaluations: ArtisanEvaluation[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Evaluateur</TableHead><TableHead>Note</TableHead><TableHead>Commentaire</TableHead></TableRow></TableHeader>
      <TableBody>
        {evaluations.map((item) => (
          <TableRow key={item.id}><TableCell>{item.evaluator_role}</TableCell><TableCell>{item.average_rating}/5</TableCell><TableCell>{item.comment ?? "-"}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function money(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function date(value: string) {
  return new Date(value).toLocaleDateString("fr-FR");
}

function time(value: string) {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
