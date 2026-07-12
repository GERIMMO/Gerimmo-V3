import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Payload = Awaited<ReturnType<typeof import("@/services/marketing-service").getMarketingCenter>>;
const money = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function MarketingCenter({ payload }: { payload: Payload }) {
  const metrics = [
    ["Prospects", payload.metrics.prospects],
    ["Essais", payload.metrics.trials],
    ["Conversions", payload.metrics.conversions],
    ["Transformation", `${payload.metrics.conversionRate} %`],
    ["Clients actifs", payload.metrics.activeCustomers],
    ["Revenus encaissés", money(payload.metrics.revenueCents)],
  ];
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-semibold text-2xl">Centre Marketing</h1>
        <p className="text-muted-foreground text-sm">Acquisition, essais et conversion commerciale.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{label}</div>
              <div className="mt-1 font-semibold text-xl">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Demandes commerciales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prospect</TableHead>
                <TableHead>Demande</TableHead>
                <TableHead>Biens</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="font-medium">{lead.full_name}</div>
                    <div className="text-muted-foreground text-xs">
                      {lead.company} · {lead.email}
                    </div>
                  </TableCell>
                  <TableCell>{lead.request_type}</TableCell>
                  <TableCell>{lead.properties_count}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lead.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(lead.created_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {payload.leads.length === 0 && (
            <p className="py-8 text-center text-muted-foreground text-sm">Les nouvelles demandes apparaîtront ici.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
