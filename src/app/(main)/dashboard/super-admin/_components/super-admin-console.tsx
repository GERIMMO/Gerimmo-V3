"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Archive, Eye, Import, Power, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminDashboardPayload, AdminOrganization } from "@/types/administration";

const typeLabels = { agency: "Agence", independent_owner: "Propriétaire indépendant", internal: "Interne" };

interface SuperAdminConsoleProps {
  readonly initialPayload: AdminDashboardPayload;
  readonly organizationType?: AdminOrganization["organization_type"];
  readonly title?: string;
  readonly description?: string;
  readonly defaultTab?: "organisations" | "journal";
}

export function SuperAdminConsole({
  initialPayload,
  organizationType,
  title = "Administration nationale",
  description = "Organisations, activité et contrôles GERIMMO.",
  defaultTab = "organisations",
}: SuperAdminConsoleProps) {
  const router = useRouter();
  const [payload, setPayload] = useState(initialPayload);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminOrganization | null>(null);
  const filtered = useMemo(
    () =>
      payload.organizations.filter(
        (item) =>
          (!organizationType || item.organization_type === organizationType) &&
          `${item.name} ${item.slug}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [organizationType, payload.organizations, query],
  );

  async function reload() {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (response.ok) setPayload((await response.json()) as AdminDashboardPayload);
  }

  async function status(action: "disable" | "reactivate" | "archive") {
    if (!selected) return;
    const response = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: selected.id, action }),
    });
    if (!response.ok) return toast.error("Action impossible.");
    toast.success("Organisation mise à jour.");
    setSelected(null);
    await reload();
  }

  async function mirror() {
    if (!selected) return;
    const response = await fetch("/api/admin/mirror", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: selected.id, reason: "Assistance et contrôle Super Admin" }),
    });
    if (!response.ok) return toast.error("Vue miroir impossible.");
    router.push("/dashboard/accueil");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/imports">
            <Import data-icon="inline-start" />
            Importer
          </Link>
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {payload.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-xs">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent className="font-semibold text-2xl">{metric.value}</CardContent>
          </Card>
        ))}
      </div>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="organisations">Organisations</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>
        <TabsContent value="organisations" className="flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une organisation"
            />
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Biens</TableHead>
                    <TableHead>Utilisateurs</TableHead>
                    <TableHead>Incidents</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((organization) => (
                    <TableRow
                      key={organization.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(organization)}
                    >
                      <TableCell>
                        <div className="font-medium">{organization.name}</div>
                        <div className="text-muted-foreground text-xs">{organization.slug}</div>
                      </TableCell>
                      <TableCell>{typeLabels[organization.organization_type]}</TableCell>
                      <TableCell>{organization.properties_count}</TableCell>
                      <TableCell>{organization.users_count}</TableCell>
                      <TableCell>{organization.incidents_count}</TableCell>
                      <TableCell>
                        <Badge variant={organization.status === "active" ? "default" : "secondary"}>
                          {organization.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="journal">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Ressource</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.created_at).toLocaleString("fr-FR")}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>{log.table_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  {typeLabels[selected.organization_type]} · {selected.slug}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4">
                <Button onClick={mirror}>
                  <Eye data-icon="inline-start" />
                  Ouvrir la vue miroir
                </Button>
                {selected.status === "active" ? (
                  <Button variant="outline" onClick={() => status("disable")}>
                    <Power data-icon="inline-start" />
                    Désactiver
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => status("reactivate")}>
                    <RotateCcw data-icon="inline-start" />
                    Réactiver
                  </Button>
                )}
                <Button variant="destructive" onClick={() => status("archive")}>
                  <Archive data-icon="inline-start" />
                  Archiver
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
