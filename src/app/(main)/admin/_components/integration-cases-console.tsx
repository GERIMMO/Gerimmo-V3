import { ClipboardCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { IntegrationCase, IntegrationStage } from "@/services/integration-cases-service";

const stageLabel: Record<IntegrationStage, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  en_service: "En service",
};

const stageVariant: Record<IntegrationStage, "secondary" | "default" | "outline"> = {
  nouveau: "outline",
  en_cours: "secondary",
  en_service: "default",
};

const typeLabel: Record<string, string> = {
  agency: "Agence",
  independent_owner: "Propriétaire",
  internal: "Interne",
};

function frDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function IntegrationCasesConsole({ cases }: { cases: IntegrationCase[] }) {
  const counts = {
    nouveau: cases.filter((item) => item.stage === "nouveau").length,
    en_cours: cases.filter((item) => item.stage === "en_cours").length,
    en_service: cases.filter((item) => item.stage === "en_service").length,
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="text-primary" />
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Dossiers d’intégration</h1>
          <p className="text-muted-foreground text-sm">
            Suivi de l’arrivée des organisations et de leur mise en service.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Nouveaux" value={counts.nouveau} />
        <Metric label="En cours" value={counts.en_cours} />
        <Metric label="En service" value={counts.en_service} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organisation</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Créée le</TableHead>
              <TableHead className="text-right">Membres</TableHead>
              <TableHead className="text-right">Biens</TableHead>
              <TableHead>Abonnement</TableHead>
              <TableHead>Intégration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((item) => (
              <TableRow key={item.organization_id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{typeLabel[item.organization_type] ?? item.organization_type}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{frDate(item.created_at)}</TableCell>
                <TableCell className="text-right tabular-nums">{item.members}</TableCell>
                <TableCell className="text-right tabular-nums">{item.biens}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{item.subscription_status ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={stageVariant[item.stage]}>{stageLabel[item.stage]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {cases.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyTitle>Aucune organisation</EmptyTitle>
              <EmptyDescription>Aucune organisation n’est encore enregistrée.</EmptyDescription>
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
