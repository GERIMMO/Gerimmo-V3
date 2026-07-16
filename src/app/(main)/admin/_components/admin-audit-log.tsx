"use client";

import { useMemo, useState } from "react";

import { Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminAuditEntry, AdminAuditPayload } from "@/types/admin-audit";

const ACTION_LABELS: Readonly<Record<string, string>> = {
  INSERT: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  SUPERVISION_STARTED: "Supervision démarrée",
  SUPERVISION_ENDED: "Supervision terminée",
  CONTEXT_ENTERED: "Contexte de supervision ouvert",
  CONTEXT_EXITED: "Contexte de supervision quitté",
  PORTAL_ROUTE_VIEWED: "Écran supervisé consulté",
};

function labelAction(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ").toLocaleLowerCase("fr");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function unique(entries: readonly AdminAuditEntry[], key: keyof AdminAuditEntry) {
  return [...new Set(entries.map((entry) => String(entry[key])).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "fr"),
  );
}

export function AdminAuditLog({ payload }: { readonly payload: AdminAuditPayload }) {
  const [query, setQuery] = useState("");
  const [organization, setOrganization] = useState("all");
  const [role, setRole] = useState("all");
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");
  const [date, setDate] = useState("");

  const organizations = useMemo(() => unique(payload.entries, "organizationName"), [payload.entries]);
  const roles = useMemo(() => unique(payload.entries, "role"), [payload.entries]);
  const modules = useMemo(() => unique(payload.entries, "module"), [payload.entries]);
  const actions = useMemo(() => unique(payload.entries, "action"), [payload.entries]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return payload.entries.filter((entry) => {
      if (organization !== "all" && entry.organizationName !== organization) return false;
      if (role !== "all" && entry.role !== role) return false;
      if (module !== "all" && entry.module !== module) return false;
      if (action !== "all" && entry.action !== action) return false;
      if (date && !entry.createdAt.startsWith(date)) return false;
      if (!normalized) return true;
      return [entry.actorName, entry.actorEmail, entry.organizationName, entry.module, entry.action, entry.resource]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("fr").includes(normalized));
    });
  }, [action, date, module, organization, payload.entries, query, role]);

  return (
    <section className="flex flex-col gap-4">
      <header className="border-b pb-4">
        <h1 className="font-heading font-semibold text-2xl">Journal d’audit</h1>
        <p className="text-muted-foreground text-sm">
          Traçabilité des actions sensibles et des accès en Mode Supervision.
        </p>
      </header>

      <Card size="sm" className="gap-0">
        <CardHeader className="border-b">
          <div>
            <CardTitle>Événements enregistrés</CardTitle>
            <CardDescription>
              {payload.limited ? "Les événements les plus récents sont affichés." : "Historique disponible."}
            </CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Utilisateur ou ressource"
                aria-label="Rechercher dans le journal"
                className="pl-8"
              />
            </div>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Date" />
            <AuditSelect
              label="Toutes les agences"
              value={organization}
              onChange={setOrganization}
              options={organizations}
            />
            <AuditSelect label="Tous les rôles" value={role} onChange={setRole} options={roles} />
            <AuditSelect label="Tous les modules" value={module} onChange={setModule} options={modules} />
            <AuditSelect
              label="Toutes les actions"
              value={action}
              onChange={setAction}
              options={actions}
              actionLabels
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <Empty className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldCheck />
                </EmptyMedia>
                <EmptyTitle>Aucun événement</EmptyTitle>
                <EmptyDescription>Aucune action ne correspond aux filtres sélectionnés.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Ressource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={`${entry.source}:${entry.id}`}>
                    <TableCell className="pl-4 text-muted-foreground text-xs">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>
                      <span className="block font-medium">{entry.actorName}</span>
                      {entry.actorEmail ? (
                        <span className="block text-muted-foreground text-xs">{entry.actorEmail}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{entry.organizationName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.role}</Badge>
                    </TableCell>
                    <TableCell>{entry.module}</TableCell>
                    <TableCell>{labelAction(entry.action)}</TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {entry.route ?? entry.resource}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function AuditSelect({
  label,
  value,
  onChange,
  options,
  actionLabels = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly actionLabels?: boolean;
}) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <NativeSelectOption value="all">{label}</NativeSelectOption>
      {options.map((option) => (
        <NativeSelectOption key={option} value={option}>
          {actionLabels ? labelAction(option) : option}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
