import Link from "next/link";

import { ArrowRight, Building2, CircleAlert, Eye, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminDashboardPayload, PilotagePayload } from "@/types/administration";

const severityLabels = { info: "Information", attention: "À surveiller", urgent: "Urgent" } as const;

export function AdminCommandCenter({
  dashboard,
  pilotage,
}: {
  readonly dashboard: AdminDashboardPayload;
  readonly pilotage: PilotagePayload;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="font-heading font-semibold text-2xl">Centre de commandement</h1>
          <p className="text-muted-foreground text-sm">Pilotage national et accès aux portails GERIMMO.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/tasks">
              <ListChecks data-icon="inline-start" />À traiter
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/supervision">
              <Eye data-icon="inline-start" />
              Supervision
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {dashboard.metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="focus-visible:outline-none">
            <Card size="sm" className="h-full transition-colors hover:border-primary/40 focus-visible:ring-2">
              <CardHeader>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{metric.value.toLocaleString("fr-FR")}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>À traiter maintenant</CardTitle>
              <CardDescription>Recommandations explicables produites par GERIMMO.</CardDescription>
            </div>
            <Badge variant="secondary">{pilotage.actions.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {pilotage.actions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Action</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pilotage.actions.slice(0, 6).map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{action.title}</div>
                        <div className="line-clamp-1 text-muted-foreground text-xs">{action.explanation}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={action.severity === "urgent" ? "destructive" : "outline"}>
                          {severityLabels[action.severity]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {action.action_url ? (
                          <Button asChild variant="ghost" size="icon-sm">
                            <Link href={action.action_url} aria-label={`Ouvrir ${action.title}`}>
                              <ArrowRight />
                            </Link>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className="min-h-44">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CircleAlert />
                  </EmptyMedia>
                  <EmptyTitle>Aucune action en attente</EmptyTitle>
                  <EmptyDescription>Les nouvelles priorités apparaîtront ici.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Réseau récent</CardTitle>
            <CardDescription>Ouvrez une organisation pour entrer dans son portail.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Organisation</TableHead>
                  <TableHead>Biens</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.organizations.slice(0, 6).map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell className="pl-4">
                      <Link
                        href={organization.organization_type === "agency" ? "/admin/agencies" : "/admin/owners"}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <Building2 className="size-4 text-muted-foreground" />
                        {organization.name}
                      </Link>
                    </TableCell>
                    <TableCell>{organization.properties_count}</TableCell>
                    <TableCell>
                      <Badge variant={organization.status === "active" ? "outline" : "secondary"}>
                        {organization.status === "active" ? "Active" : "Suspendue"}
                      </Badge>
                    </TableCell>
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
