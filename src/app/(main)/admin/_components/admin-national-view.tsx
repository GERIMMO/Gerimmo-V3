"use client";

import { useMemo, useState } from "react";

import { ChevronRight, Database, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  AdminNationalColumn,
  AdminNationalFormat,
  AdminNationalPayload,
  AdminNationalRow,
  AdminNationalValue,
} from "@/types/admin-national";

const STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "Actif",
  inactive: "Inactif",
  suspended: "Suspendu",
  archived: "Archivé",
  archive: "Archivé",
  invited: "Invité",
  pending: "En attente",
  processing: "En traitement",
  processed: "Traité",
  failed: "Échec",
  sent: "Envoyé",
  received: "Reçu",
  received_quote: "Devis reçu",
  requested: "Demandé",
  demande: "Demandé",
  nouveau: "Nouveau",
  en_cours: "En cours",
  cloture: "Clôturé",
  planifiee: "Planifiée",
  confirmee: "Confirmée",
  terminee: "Terminée",
  annulee: "Annulée",
  ouverte: "Ouverte",
  open: "Ouverte",
  acknowledged: "Prise en compte",
  resolved: "Résolue",
  ignored: "Ignorée",
  new: "Nouveau",
  analyzing: "En analyse",
  awaiting_approval: "Validation requise",
  approved: "Approuvé",
  rejected: "Refusé",
  low: "Faible",
  normal: "Normale",
  normale: "Normale",
  high: "Élevée",
  haute: "Haute",
  urgent: "Urgent",
  urgente: "Urgente",
  critical: "Critique",
  globale: "Globale",
  global: "Globale",
  organization: "Organisation",
  directe: "Directe",
  groupe: "Groupe",
  support: "Support",
  admin: "Administrateur",
  agent: "Agent",
  owner: "Propriétaire",
  contractor: "Artisan",
  tenant: "Locataire",
};

function statusLabel(value: AdminNationalValue) {
  const key = String(value ?? "").toLowerCase();
  return STATUS_LABELS[key] ?? String(value ?? "Non renseigné").replaceAll("_", " ");
}

function statusTone(value: AdminNationalValue) {
  const key = String(value ?? "").toLowerCase();
  if (["critical", "urgent", "urgente", "failed", "suspended", "rejected"].includes(key)) {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }
  if (["warning", "high", "haute", "pending", "requested", "demande", "awaiting_approval"].includes(key)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (["active", "processed", "resolved", "approved", "terminee", "cloture", "confirmee"].includes(key)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "border-border bg-muted/60 text-muted-foreground";
}

function formatValue(value: AdminNationalValue, format: AdminNationalFormat = "text") {
  if (value === null || value === "") return "Non renseigné";
  if (format === "money" && typeof value === "number") {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value / 100);
  }
  if (format === "date" && typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
    }
  }
  if (format === "boolean") return value ? "Oui" : "Non";
  if (format === "status") return statusLabel(value);
  return String(value);
}

function Value({ value, column }: { readonly value: AdminNationalValue; readonly column: AdminNationalColumn }) {
  if (column.format === "status" || column.format === "boolean") {
    let badgeValue = value;
    if (column.format === "boolean") badgeValue = value ? "Actif" : "Inactif";
    return (
      <Badge variant="outline" className={cn("font-normal", statusTone(badgeValue))}>
        {formatValue(value, column.format)}
      </Badge>
    );
  }
  return <span>{formatValue(value, column.format)}</span>;
}

export function AdminNationalView({ payload }: { readonly payload: AdminNationalPayload }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<AdminNationalRow | null>(null);

  const statusOptions = useMemo(() => {
    if (!payload.statusKey) return [];
    return [...new Set(payload.rows.map((row) => String(row.values[payload.statusKey ?? ""] ?? "")))]
      .filter(Boolean)
      .sort((left, right) => statusLabel(left).localeCompare(statusLabel(right), "fr"));
  }, [payload.rows, payload.statusKey]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return payload.rows.filter((row) => {
      const matchesStatus =
        status === "all" || (payload.statusKey ? String(row.values[payload.statusKey] ?? "") === status : true);
      if (!matchesStatus) return false;
      if (!normalized) return true;
      return [row.title, row.organizationName, ...Object.values(row.values)]
        .filter((value) => value !== null)
        .some((value) => String(value).toLocaleLowerCase("fr").includes(normalized));
    });
  }, [payload.rows, payload.statusKey, query, status]);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h1 className="font-heading font-semibold text-xl sm:text-2xl">{payload.title}</h1>
            <Badge variant="secondary">{payload.total.toLocaleString("fr-FR")}</Badge>
          </div>
          <p className="max-w-3xl text-muted-foreground text-sm">{payload.description}</p>
        </div>
        <p className="shrink-0 text-muted-foreground text-xs">
          {payload.shown < payload.total
            ? `${payload.shown.toLocaleString("fr-FR")} derniers éléments affichés`
            : `${payload.total.toLocaleString("fr-FR")} ${payload.sourceLabel}`}
        </p>
      </header>

      <Card size="sm" className="gap-0 rounded-lg">
        <CardHeader className="border-b py-3 sm:grid-cols-[1fr_auto]">
          <div>
            <CardTitle>Données nationales</CardTitle>
            <CardDescription>Données réelles enregistrées dans Supabase.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative block min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <span className="sr-only">Rechercher</span>
              <Input
                aria-label="Rechercher"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher"
                className="pl-8"
              />
            </div>
            {statusOptions.length > 0 ? (
              <NativeSelect
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Filtrer par statut"
              >
                <NativeSelectOption value="all">Tous les statuts</NativeSelectOption>
                {statusOptions.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {statusLabel(option)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <Empty className="min-h-64 rounded-none border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Database />
                </EmptyMedia>
                <EmptyTitle>{payload.rows.length === 0 ? `Aucun ${payload.sourceLabel}` : "Aucun résultat"}</EmptyTitle>
                <EmptyDescription>
                  {payload.rows.length === 0
                    ? "Aucune donnée réelle n’est encore enregistrée pour ce périmètre."
                    : "Modifiez la recherche ou le filtre sélectionné."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56 pl-4">Élément</TableHead>
                  <TableHead className="min-w-48">Organisation</TableHead>
                  {payload.columns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                  <TableHead className="w-10">
                    <span className="sr-only">Consulter</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => setSelected(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(row);
                      }
                    }}
                  >
                    <TableCell className="max-w-72 pl-4 font-medium">
                      <span className="block truncate">{row.title}</span>
                    </TableCell>
                    <TableCell className="max-w-64 text-muted-foreground">
                      <span className="block truncate">{row.organizationName ?? "GERIMMO"}</span>
                    </TableCell>
                    {payload.columns.map((column) => (
                      <TableCell key={column.key} className="max-w-72 text-muted-foreground">
                        <span className="block truncate">
                          <Value value={row.values[column.key] ?? null} column={column} />
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className="pr-4 text-right">
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>{selected?.title}</SheetTitle>
            <SheetDescription>{selected?.organizationName ?? "GERIMMO"}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <dl className="divide-y">
              {payload.columns.map((column) => (
                <div key={column.key} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-3">
                  <dt className="font-medium text-muted-foreground text-xs">{column.label}</dt>
                  <dd className="min-w-0 break-words text-right text-sm">
                    {selected ? <Value value={selected.values[column.key] ?? null} column={column} /> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
