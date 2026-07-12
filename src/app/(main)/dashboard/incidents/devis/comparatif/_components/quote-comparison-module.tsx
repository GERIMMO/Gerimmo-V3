"use client";

import { useMemo, useState } from "react";

import { Check, RefreshCw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { IncidentQuoteComparisonsPayload } from "@/types/incident-quote-comparisons";

export function QuoteComparisonModule({ initialPayload }: { initialPayload: IncidentQuoteComparisonsPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedComparisonId, setSelectedComparisonId] = useState(initialPayload.comparisons[0]?.id ?? "");
  const selected = payload.comparisons.find((item) => item.id === selectedComparisonId) ?? null;
  const items = useMemo(
    () =>
      payload.items
        .filter((item) => item.comparison_id === selectedComparisonId)
        .sort((a, b) => b.recommendation_score - a.recommendation_score),
    [payload.items, selectedComparisonId],
  );

  async function reload() {
    const response = await fetch("/api/incidents/devis/comparatif", { cache: "no-store" });
    if (!response.ok) throw new Error("Actualisation impossible.");
    setPayload((await response.json()) as IncidentQuoteComparisonsPayload);
  }
  async function recommend() {
    if (!selected) return;
    const response = await fetch(`/api/incidents/devis/comparatif/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "recommend" }),
    });
    if (!response.ok) throw new Error("Recommandation impossible.");
    await reload();
  }
  async function decide(quoteId: string, decision: "accept" | "refuse") {
    if (!selected) return;
    const response = await fetch(`/api/incidents/devis/comparatif/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quote_id: quoteId, decision }),
    });
    if (!response.ok) throw new Error("Décision impossible.");
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Comparatif des devis</h1>
          <p className="text-muted-foreground text-sm">Recommandation informative, décision finale du responsable.</p>
        </div>
        {selected && (
          <Button size="sm" variant="outline" onClick={recommend}>
            <RefreshCw data-icon="inline-start" />
            Recalculer
          </Button>
        )}
      </header>
      {payload.comparisons.length ? (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {payload.comparisons.map((comparison) => (
              <Button
                key={comparison.id}
                size="sm"
                variant={comparison.id === selectedComparisonId ? "default" : "outline"}
                onClick={() => setSelectedComparisonId(comparison.id)}
              >
                {comparison.status}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artisan</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Délai</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Conformité</TableHead>
                    <TableHead>Décision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.artisan_name}</div>
                        {item.is_recommended && <Badge variant="secondary">Recommandé</Badge>}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                          item.price_cents / 100,
                        )}
                      </TableCell>
                      <TableCell>{item.announced_delay_days ?? "-"} j</TableCell>
                      <TableCell>{item.gerimmo_rating}/5</TableCell>
                      <TableCell>{item.administrative_documents_valid ? "Valide" : "À compléter"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon-sm" onClick={() => decide(item.quote_id, "accept")} aria-label="Accepter">
                            <Check />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => decide(item.quote_id, "refuse")}
                            aria-label="Refuser"
                          >
                            <X />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Aucun comparatif</EmptyTitle>
            <EmptyDescription>Un comparatif apparaîtra après réception des devis.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
