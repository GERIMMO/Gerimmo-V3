import { Activity, Eye, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SupervisionCenterPayload } from "@/types/supervision";

const actionLabels: Readonly<Record<string, string>> = {
  SUPERVISION_STARTED: "Supervision démarrée",
  SUPERVISION_ENDED: "Supervision terminée",
  CONTEXT_ENTERED: "Contexte ouvert",
  CONTEXT_EXITED: "Contexte quitté",
  PORTAL_ROUTE_VIEWED: "Écran consulté",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SupervisionCenter({ payload }: { readonly payload: SupervisionCenterPayload }) {
  const active = payload.active;

  return (
    <section className="flex flex-col gap-4">
      <header className="border-b pb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-heading font-semibold text-2xl">Supervision temps réel</h1>
          <Badge variant={active ? "default" : "secondary"}>{active ? "Active" : "Inactive"}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Pilotage des portails sans changement de session, de JWT ou d’identité utilisateur.
        </p>
      </header>

      {active ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye />
              Contexte actuellement piloté
            </CardTitle>
            <CardDescription>{active.reason}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {active.path.map((item, index) => (
              <span key={item.id} className="flex items-center gap-2">
                {index > 0 ? <span className="text-muted-foreground">/</span> : null}
                <Badge variant={index === active.path.length - 1 ? "default" : "outline"}>{item.label}</Badge>
              </span>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Empty className="min-h-40 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Activity />
            </EmptyMedia>
            <EmptyTitle>Aucune supervision active</EmptyTitle>
            <EmptyDescription>
              Utilisez la recherche globale ou ouvrez une organisation depuis le réseau.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Sessions récentes</CardTitle>
            <CardDescription>Historique des accès de supervision.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Organisation</TableHead>
                  <TableHead>Administrateur</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="pl-4 font-medium">{session.organizationName}</TableCell>
                    <TableCell>{session.administratorName}</TableCell>
                    <TableCell>{formatDate(session.startedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={session.status === "active" ? "default" : "secondary"}>
                        {session.status === "active" ? "Active" : "Terminée"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History />
              Derniers événements
            </CardTitle>
            <CardDescription>Transitions et écrans consultés en mode supervision.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Action</TableHead>
                  <TableHead>Ressource</TableHead>
                  <TableHead>Écran</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="pl-4 font-medium">{actionLabels[event.action] ?? event.action}</TableCell>
                    <TableCell>{event.resourceType ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate">{event.route ?? "—"}</TableCell>
                    <TableCell>{formatDate(event.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
