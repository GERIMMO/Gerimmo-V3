"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { IncidentFinalizationPayload } from "@/types/incident-finalization";
import type { IncidentQuotesPayload } from "@/types/incident-quotes";
import type { IncidentSchedulingPayload } from "@/types/incident-scheduling";
import type { IncidentsPayload } from "@/types/incidents";

export function IncidentDossierModule({
  incidents,
  quotes,
  scheduling,
  finalization: initialFinalization,
}: {
  incidents: IncidentsPayload;
  quotes: IncidentQuotesPayload;
  scheduling: IncidentSchedulingPayload;
  finalization: IncidentFinalizationPayload;
}) {
  const [selectedId, setSelectedId] = useState(incidents.incidents[0]?.id ?? "");
  const [finalization, setFinalization] = useState(initialFinalization);
  const incident = incidents.incidents.find((item) => item.id === selectedId) ?? null;
  const requests = quotes.requests.filter((item) => item.incident_id === selectedId);
  const schedules = scheduling.requests.filter((item) => item.incident_id === selectedId);
  const interventions = finalization.interventions.filter((item) => item.incident_id === selectedId);
  const reports = finalization.reports.filter((item) => item.incident_id === selectedId);
  const closures = finalization.closures.filter((item) => item.incident_id === selectedId);
  const evaluations = finalization.evaluations.filter((item) => item.incident_id === selectedId);
  const timeline = useMemo(
    () =>
      [
        ...incidents.events
          .filter((item) => item.incident_id === selectedId)
          .map((item) => ({ id: item.id, action: item.action, date: item.created_at })),
        ...quotes.events
          .filter((item) => requests.some((request) => request.id === item.quote_request_id))
          .map((item) => ({ id: item.id, action: item.action, date: item.created_at })),
        ...scheduling.events
          .filter((item) => schedules.some((request) => request.id === item.schedule_request_id))
          .map((item) => ({ id: item.id, action: item.action, date: item.created_at })),
        ...finalization.interventionEvents
          .filter((item) => item.incident_id === selectedId)
          .map((item) => ({ id: item.id, action: item.action, date: item.created_at })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [
      finalization.interventionEvents,
      incidents.events,
      quotes.events,
      requests,
      schedules,
      scheduling.events,
      selectedId,
    ],
  );

  async function reloadFinalization() {
    const response = await fetch("/api/incidents/finalisation", { cache: "no-store" });
    if (!response.ok) throw new Error("Actualisation impossible.");
    setFinalization((await response.json()) as IncidentFinalizationPayload);
  }
  async function interventionAction(id: string, action: string) {
    const response = await fetch(`/api/incidents/finalisation/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) throw new Error("Action impossible.");
    await reloadFinalization();
  }

  if (!incidents.incidents.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Aucun dossier incident</EmptyTitle>
          <EmptyDescription>Les incidents persistés apparaîtront ici.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-semibold text-2xl">Dossier incident</h1>
        <p className="text-muted-foreground text-sm">Vue unifiée de l’ensemble du parcours.</p>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {incidents.incidents.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={item.id === selectedId ? "default" : "outline"}
            onClick={() => setSelectedId(item.id)}
          >
            {item.number}
          </Button>
        ))}
      </div>
      {incident && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric title="Statut" value={incident.status} />
            <Metric title="Devis" value={String(requests.length)} />
            <Metric title="Planifications" value={String(schedules.length)} />
            <Metric title="Interventions" value={String(interventions.length)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{incident.number}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>{incident.description}</p>
              <div className="flex gap-2">
                <Badge>{incident.priority}</Badge>
                <Badge variant="outline">{incident.category}</Badge>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 lg:grid-cols-2">
            <Section title="Interventions">
              {interventions.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
                  <span>
                    {item.execution_mode} · {item.status}
                  </span>
                  <div className="flex gap-1">
                    {item.status === "confirmee" && (
                      <Button size="xs" onClick={() => interventionAction(item.id, "demarrer")}>
                        Démarrer
                      </Button>
                    )}
                    {item.status === "en_cours" && (
                      <Button size="xs" variant="outline" onClick={() => interventionAction(item.id, "suspendre")}>
                        Suspendre
                      </Button>
                    )}
                    {item.status === "suspendue" && (
                      <Button size="xs" onClick={() => interventionAction(item.id, "reprendre")}>
                        Reprendre
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Section>
            <Section title="Rapports et clôture">
              <p className="text-sm">
                {reports.length} rapport(s) · {closures.length} clôture(s) · {evaluations.length} évaluation(s)
              </p>
            </Section>
          </div>
          <Section title="Chronologie">
            {timeline.slice(0, 100).map((item) => (
              <div key={`${item.id}-${item.action}`} className="flex justify-between gap-3 border-b py-2 text-sm">
                <span>{item.action.replaceAll("_", " ")}</span>
                <time className="text-muted-foreground">{new Date(item.date).toLocaleString("fr-FR")}</time>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="font-semibold text-xl capitalize">{value.replaceAll("_", " ")}</CardContent>
    </Card>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
