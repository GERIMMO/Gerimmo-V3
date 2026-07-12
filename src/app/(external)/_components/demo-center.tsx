"use client";

import { demoAgency } from "@/config/demo-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DemoCenter() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {demoAgency.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{metric.label}</div>
              <div className="mt-1 font-semibold text-2xl">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{demoAgency.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="incidents">
            <TabsList>
              <TabsTrigger value="incidents">Incidents</TabsTrigger>
              <TabsTrigger value="biens">Biens</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="artisans">Artisans</TabsTrigger>
            </TabsList>
            <TabsContent value="incidents">
              <DemoTable
                headers={["Référence", "Sujet", "Bien", "Statut"]}
                rows={demoAgency.incidents.map((item) => [item.reference, item.subject, item.property, item.status])}
              />
            </TabsContent>
            <TabsContent value="biens">
              <DemoTable
                headers={["Référence", "Adresse", "Occupant", "Statut"]}
                rows={demoAgency.properties.map((item) => [item.reference, item.address, item.tenant, item.status])}
              />
            </TabsContent>
            <TabsContent value="documents">
              <DemoTable
                headers={["Document", "Catégorie", "État"]}
                rows={demoAgency.documents.map((item) => [item.name, item.category, item.validity])}
              />
            </TabsContent>
            <TabsContent value="artisans">
              <DemoTable
                headers={["Artisan", "Métier", "Note"]}
                rows={demoAgency.artisans.map((item) => [item.name, item.trade, item.rating])}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Planning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              5 rendez-vous confirmés, 2 séries de créneaux en attente et une intervention à reprogrammer.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rapports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Les rapports d’intervention validés sont automatiquement rattachés aux biens et incidents concernés.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Statistiques</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Délai moyen de prise en charge : 3 h 42. Satisfaction artisan : 4,7 sur 5.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
function DemoTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.join("-")}>
            {row.map((cell, index) => (
              <TableCell key={`${cell}-${index}`}>
                {index === row.length - 1 ? <Badge variant="secondary">{cell}</Badge> : cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
