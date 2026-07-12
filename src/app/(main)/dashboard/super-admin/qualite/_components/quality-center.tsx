"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Gauge, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CorrectionProposal, QualityCenterPayload } from "@/types/quality";

const severityLabel = { low: "Faible", medium: "Modérée", high: "Élevée", critical: "Critique" };
const severityClass = {
  low: "bg-emerald-500/10 text-emerald-700",
  medium: "bg-amber-500/10 text-amber-700",
  high: "bg-orange-500/10 text-orange-700",
  critical: "bg-red-500/10 text-red-700",
};

export function QualityCenter({ initialPayload }: { initialPayload: QualityCenterPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [query, setQuery] = useState("");
  const filtered = payload.reports.filter((report) =>
    `${report.reference} ${report.title} ${report.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function action(body: Record<string, string>) {
    const response = await fetch("/api/quality", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Action impossible.");
    if (body.action === "analyze")
      setPayload((current) => ({
        ...current,
        analyses: [data.analysis, ...current.analyses.filter((item) => item.report_id !== body.reportId)],
        proposals: [data.proposal, ...current.proposals.filter((item) => item.report_id !== body.reportId)],
      }));
    else
      setPayload((current) => ({
        ...current,
        proposals: current.proposals.map((item) => (item.id === body.proposalId ? data : item)),
      }));
    toast.success("Décision enregistrée et auditée.");
  }
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Centre Qualité</h1>
          <p className="text-muted-foreground text-sm">Incidents techniques, surveillance et décisions contrôlées.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {payload.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{metric.label}</div>
              <div className="mt-1 font-semibold text-2xl">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Signalements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {filtered.map((report) => {
              const analysis = payload.analyses.find((item) => item.report_id === report.id);
              return (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{report.reference}</span>
                      <Badge variant="secondary">{report.priority}</Badge>
                    </div>
                    <div className="truncate text-sm">{report.title}</div>
                    <div className="text-muted-foreground text-xs">{report.screen_path ?? "Écran non précisé"}</div>
                  </div>
                  {analysis ? (
                    <Badge className={severityClass[analysis.severity]}>{severityLabel[analysis.severity]}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => action({ action: "analyze", reportId: report.id })}
                    >
                      Analyser
                    </Button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && <p className="text-muted-foreground text-sm">Aucun signalement correspondant.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>État des sources</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {payload.sourceHealth.map((source) => (
              <div
                key={source.source}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b py-2 last:border-0"
              >
                <span className="capitalize text-sm">{source.source}</span>
                <Badge variant={source.errors ? "destructive" : "secondary"}>{source.errors} erreur(s)</Badge>
                <span className="text-muted-foreground text-xs">{source.averageDurationMs} ms</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Alertes actives
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {payload.alerts.map((alert) => (
              <div key={String(alert.id)} className="border-b py-2 last:border-0">
                <div className="font-medium text-sm">{String(alert.title)}</div>
                <div className="text-muted-foreground text-xs">
                  {String(alert.source)} · {String(alert.occurrence_count)} occurrence(s)
                </div>
              </div>
            ))}
            {payload.alerts.length === 0 && <p className="text-muted-foreground text-sm">Aucune alerte active.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" />
              Continuité
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Status label="Sauvegardes enregistrées" value={payload.backups.length} />
            <Status label="Demandes RGPD" value={payload.privacyRequests.length} />
            <Status
              label="Plans en attente"
              value={payload.proposals.filter((item) => item.status === "awaiting_approval").length}
            />
            <Status label="Sources surveillées" value={payload.sourceHealth.length} />
          </CardContent>
        </Card>
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-lg">Rapports de correction</h2>
          <p className="text-muted-foreground text-sm">
            L’approbation ne modifie aucun fichier. Elle autorise uniquement la préparation manuelle contrôlée.
          </p>
        </div>
        {payload.proposals.map((proposal) => (
          <Proposal
            key={proposal.id}
            proposal={proposal}
            onDecision={(decision) => action({ action: decision, proposalId: proposal.id })}
          />
        ))}
      </section>
    </div>
  );
}

function Status({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-xl">{value}</div>
    </div>
  );
}

function Proposal({
  proposal,
  onDecision,
}: {
  proposal: CorrectionProposal;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  const rows = [
    ["PROBLÈME", proposal.problem],
    ["CAUSE", proposal.cause],
    ["POURQUOI", proposal.why],
    ["FICHIERS MODIFIÉS", proposal.modified_files.join(", ") || "À confirmer"],
    ["TABLES IMPACTÉES", proposal.impacted_tables.join(", ") || "Aucune identifiée"],
    ["WORKFLOWS IMPACTÉS", proposal.impacted_workflows.join(", ") || "Aucun identifié"],
    ["UTILISATEURS IMPACTÉS", proposal.impacted_users],
    ["RISQUES", proposal.risks],
    ["CE QUI VA CHANGER", proposal.changes],
    ["CE QUI NE CHANGERA PAS", proposal.unchanged],
    ["CONSÉQUENCES POSITIVES", proposal.positive_outcomes],
    ["TEMPS ESTIMÉ", proposal.estimated_minutes ? `${proposal.estimated_minutes} minutes` : "À estimer"],
    ["TESTS QUI SERONT LANCÉS", proposal.planned_tests.join(", ")],
    ["PLAN DE RETOUR ARRIÈRE", proposal.rollback_plan],
    ["SAUVEGARDE GIT", proposal.git_backup_plan],
  ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <span className="font-medium">Proposition contrôlée</span>
          </div>
          <Badge variant="secondary">{proposal.status}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <div className="font-medium text-muted-foreground text-xs">{label}</div>
              <div className="text-sm">{value}</div>
            </div>
          ))}
        </div>
        {proposal.sensitive_areas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {proposal.sensitive_areas.map((area) => (
              <Badge key={area} variant="destructive">
                Validation obligatoire · {area}
              </Badge>
            ))}
          </div>
        )}
        {proposal.status === "awaiting_approval" && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onDecision("reject")}>
              Annuler
            </Button>
            <Button onClick={() => onDecision("approve")}>
              <CheckCircle2 data-icon="inline-start" />
              Approuver le plan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
