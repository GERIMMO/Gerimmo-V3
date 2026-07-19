"use client";

import { useState } from "react";

import { BellRing, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExpiringDocumentRow } from "@/services/document-reminder-service";

function frDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function delayLabel(daysLeft: number) {
  if (daysLeft < 0) return { text: `Expiré depuis ${-daysLeft} j`, variant: "destructive" as const };
  if (daysLeft === 0) return { text: "Expire aujourd’hui", variant: "destructive" as const };
  return { text: `${daysLeft} j restants`, variant: "secondary" as const };
}

export function DocumentsEcheancesModule({ initialDocuments }: { initialDocuments: ExpiringDocumentRow[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [reminding, setReminding] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/documents/reminders");
    if (!response.ok) return toast.error("Actualisation impossible.");
    setDocuments(((await response.json()) as { documents: ExpiringDocumentRow[] }).documents);
  }

  async function remind(documentId: string) {
    setReminding(documentId);
    const response = await fetch("/api/documents/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    setReminding(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return toast.error(body.message ?? "Rappel impossible.");
    }
    const { emailed } = (await response.json()) as { emailed: boolean };
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? { ...document, reminded_at: new Date().toISOString() } : document,
      ),
    );
    toast.success(emailed ? "Rappel envoyé au destinataire." : "Rappel enregistré (aucun destinataire e-mail).");
  }

  const overdue = documents.filter((document) => document.days_left < 0).length;

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Documents à renouveler</h1>
          <p className="text-muted-foreground text-sm">
            Documents officiels arrivant à échéance. Envoyez un rappel au destinataire concerné.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh}>
          <RefreshCw data-icon="inline-start" />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="À renouveler" value={documents.length} />
        <Metric label="Déjà expirés" value={overdue} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Délai</TableHead>
              <TableHead className="text-right">Rappel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => {
              const delay = delayLabel(document.days_left);
              return (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">{document.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{document.document_type}</TableCell>
                  <TableCell>{frDate(document.expires_at)}</TableCell>
                  <TableCell>
                    <Badge variant={delay.variant}>{delay.text}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {document.reminded_at ? (
                        <span className="text-muted-foreground text-xs">Rappelé le {frDate(document.reminded_at)}</span>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={reminding === document.id}
                        onClick={() => remind(document.id)}
                      >
                        <BellRing data-icon="inline-start" />
                        Rappeler
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {documents.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyTitle>Aucune échéance</EmptyTitle>
              <EmptyDescription>Aucun document officiel n’arrive à échéance prochainement.</EmptyDescription>
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
