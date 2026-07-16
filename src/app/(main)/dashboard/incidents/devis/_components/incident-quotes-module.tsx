"use client";

import { useMemo, useState } from "react";

import { Archive, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { IncidentQuotesPayload } from "@/types/incident-quotes";

export function IncidentQuotesModule({ initialPayload }: { initialPayload: IncidentQuotesPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload.requests.at(0)?.id || "");
  const selected = payload.requests.find((item) => item.id === selectedId) ?? null;
  const recipients = useMemo(
    () => payload.recipients.filter((item) => item.quote_request_id === selectedId),
    [payload.recipients, selectedId],
  );
  const quotes = useMemo(
    () => payload.quotes.filter((item) => item.quote_request_id === selectedId),
    [payload.quotes, selectedId],
  );

  async function reload() {
    const response = await fetch("/api/incidents/devis", { cache: "no-store" });
    if (!response.ok) throw new Error("Actualisation impossible.");
    setPayload((await response.json()) as IncidentQuotesPayload);
  }
  async function action(name: "send" | "archive") {
    if (!selected) return;
    const response = await fetch(`/api/incidents/devis/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: name }),
    });
    if (!response.ok) throw new Error("Action impossible.");
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-semibold text-2xl">Demandes de devis</h1>
        <p className="text-muted-foreground text-sm">Demandes, destinataires et devis reçus.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Demandes" value={payload.requests.length} />
        <Metric label="Destinataires" value={payload.recipients.length} />
        <Metric label="Devis reçus" value={payload.quotes.length} />
      </div>
      <Card>
        <CardContent className="p-0">
          {payload.requests.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Demande</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Destinataires</TableHead>
                  <TableHead>Création</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.requests.map((request) => (
                  <TableRow key={request.id} className="cursor-pointer" onClick={() => setSelectedId(request.id)}>
                    <TableCell>
                      <div className="font-medium">{request.title}</div>
                      <div className="text-muted-foreground text-xs">{request.incident_id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{request.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {payload.recipients.filter((item) => item.quote_request_id === request.id).length}
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Aucune demande de devis</EmptyTitle>
                <EmptyDescription>Les demandes créées depuis un incident apparaîtront ici.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId("")}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {selected.status} · {recipients.length} destinataire(s)
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">
                <div className="flex gap-2">
                  {!selected.sent_at && (
                    <Button size="sm" onClick={() => action("send")}>
                      <Send data-icon="inline-start" />
                      Envoyer
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => action("archive")}>
                    <Archive data-icon="inline-start" />
                    Archiver
                  </Button>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Artisans</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {recipients.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 border-b py-2 text-sm">
                        <span>{item.artisan_name}</span>
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Devis reçus</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {quotes.map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 border-b py-2 text-sm">
                        <span>
                          {new Intl.NumberFormat("fr-FR", { style: "currency", currency: item.currency }).format(
                            item.amount_cents / 100,
                          )}
                        </span>
                        <Badge>{item.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="font-semibold text-2xl">{value}</CardContent>
    </Card>
  );
}
