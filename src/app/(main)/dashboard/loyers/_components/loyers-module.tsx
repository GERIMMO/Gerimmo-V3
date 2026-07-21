"use client";

import { useState } from "react";

import { AlertTriangle, Check, FileCheck2, PenLine, RefreshCw, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RentPeriodRow, RentPeriodStatus } from "@/services/rent-service";

const statusLabel: Record<RentPeriodStatus, string> = {
  attendu: "En attente",
  recu: "Reçu",
  impaye: "Impayé",
  mise_en_demeure: "Mise en demeure",
  annule: "Annulé",
};

const statusVariant: Record<RentPeriodStatus, "secondary" | "default" | "destructive" | "outline"> = {
  attendu: "secondary",
  recu: "default",
  impaye: "destructive",
  mise_en_demeure: "destructive",
  annule: "outline",
};

function euros(cents: number) {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`;
}

function frDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function LoyersModule({
  initialPeriods,
  signableOrganizations = [],
}: {
  initialPeriods: RentPeriodRow[];
  signableOrganizations?: string[];
}) {
  const [periods, setPeriods] = useState(initialPeriods);
  const [pending, setPending] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const signable = new Set(signableOrganizations);

  async function refresh() {
    const response = await fetch("/api/rent");
    if (!response.ok) return toast.error("Actualisation impossible.");
    setPeriods(((await response.json()) as { periods: RentPeriodRow[] }).periods);
  }

  async function generate() {
    setGenerating(true);
    const response = await fetch("/api/rent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    setGenerating(false);
    if (!response.ok) return toast.error("Génération impossible.");
    const { created } = (await response.json()) as { created: number };
    toast.success(created > 0 ? `${created} loyer(s) du mois ajouté(s).` : "Aucun nouveau loyer à générer.");
    await refresh();
  }

  async function confirm(periodId: string, received: boolean) {
    setPending(periodId);
    const response = await fetch("/api/rent", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ periodId, received }),
    });
    setPending(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return toast.error(body.message ?? "Mise à jour impossible.");
    }
    setPeriods((current) =>
      current.map((period) => (period.id === periodId ? { ...period, status: received ? "recu" : "impaye" } : period)),
    );
    toast.success(received ? "Loyer marqué reçu — quittance à valider." : "Loyer marqué impayé — relance à envoyer.");
    await refresh();
  }

  async function validateQuittance(periodId: string, sign = false) {
    setValidating(periodId);
    const response = await fetch("/api/rent/quittance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ periodId, sign }),
    });
    setValidating(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return toast.error(body.message ?? "Validation impossible.");
    }
    const { quittance_status, emailed } = (await response.json()) as { quittance_status: string; emailed: boolean };
    setPeriods((current) =>
      current.map((period) => (period.id === periodId ? { ...period, quittance_status } : period)),
    );
    const suffix = emailed ? "et envoyée au locataire" : "et disponible";
    toast.success(sign ? `Quittance signée, validée ${suffix}.` : `Quittance validée ${suffix}.`);
  }

  async function remind(periodId: string) {
    setReminding(periodId);
    const response = await fetch("/api/rent/reminder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ periodId }),
    });
    setReminding(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return toast.error(body.message ?? "Relance impossible.");
    }
    const { miseEnDemeure } = (await response.json()) as { miseEnDemeure: boolean };
    toast.success(miseEnDemeure ? "Mise en demeure envoyée au locataire." : "Relance envoyée au locataire.");
    await refresh();
  }

  const counts = {
    attendu: periods.filter((period) => period.status === "attendu").length,
    recu: periods.filter((period) => period.status === "recu").length,
    impaye: periods.filter((period) => period.status === "impaye" || period.status === "mise_en_demeure").length,
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Loyers</h1>
          <p className="text-muted-foreground text-sm">
            Confirmez la réception des loyers : « reçu » prépare la quittance, « impayé » déclenche les relances.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            <RefreshCw data-icon="inline-start" />
            Actualiser
          </Button>
          <Button type="button" size="sm" disabled={generating} onClick={generate}>
            Générer les loyers du mois
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="À confirmer" value={counts.attendu} />
        <Metric label="Reçus" value={counts.recu} />
        <Metric label="Impayés" value={counts.impaye} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bien</TableHead>
              <TableHead>Locataire</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Quittance</TableHead>
              <TableHead className="text-right">Loyer reçu ?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((period) => (
              <TableRow key={period.id}>
                <TableCell className="font-medium">
                  {period.bien_reference ? `${period.bien_reference} - ` : ""}
                  {period.bien_name ?? period.bien_id}
                </TableCell>
                <TableCell>{period.tenant_name ?? "-"}</TableCell>
                <TableCell>{frDate(period.due_date)}</TableCell>
                <TableCell>{euros(period.amount_cents)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[period.status]}>{statusLabel[period.status]}</Badge>
                </TableCell>
                <TableCell>
                  {period.quittance_status === "a_valider" ? (
                    <div className="flex flex-wrap gap-2">
                      {signable.has(period.organization_id) ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={validating === period.id}
                          onClick={() => validateQuittance(period.id, true)}
                        >
                          <PenLine data-icon="inline-start" />
                          Signer et valider
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={validating === period.id}
                        onClick={() => validateQuittance(period.id, false)}
                      >
                        <FileCheck2 data-icon="inline-start" />
                        {signable.has(period.organization_id) ? "Valider sans signer" : "Valider"}
                      </Button>
                    </div>
                  ) : period.quittance_status === "validee" ? (
                    <Badge variant="secondary">Validée</Badge>
                  ) : period.quittance_status === "envoyee" ? (
                    <Badge variant="default">Envoyée</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {period.status === "attendu" ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending === period.id}
                        onClick={() => confirm(period.id, true)}
                      >
                        <Check data-icon="inline-start" />
                        Reçu
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending === period.id}
                        onClick={() => confirm(period.id, false)}
                      >
                        <X data-icon="inline-start" />
                        Non reçu
                      </Button>
                    </div>
                  ) : period.status === "impaye" ? (
                    <div className="flex items-center justify-end gap-2">
                      {period.reminder_count > 0 ? (
                        <span className="text-muted-foreground text-xs">{period.reminder_count}/2 relance(s)</span>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant={period.reminder_count >= 2 ? "destructive" : "outline"}
                        disabled={reminding === period.id}
                        onClick={() => remind(period.id)}
                      >
                        {period.reminder_count >= 2 ? (
                          <AlertTriangle data-icon="inline-start" />
                        ) : (
                          <Send data-icon="inline-start" />
                        )}
                        {period.reminder_count >= 2 ? "Mettre en demeure" : "Relancer"}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {period.reminder_count > 0 ? `${period.reminder_count} relance(s)` : "—"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {periods.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyTitle>Aucun loyer</EmptyTitle>
              <EmptyDescription>
                Utilisez « Générer les loyers du mois » pour créer les échéances des locations actives.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-2xl">{value}</div>
    </div>
  );
}
