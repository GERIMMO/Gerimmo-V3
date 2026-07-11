"use client";

import { useState } from "react";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BotAdminPayload } from "@/types/telegram-bot";

function text(value: unknown) {
  return typeof value === "string" ? value : "-";
}

function date(value: unknown) {
  return typeof value === "string" ? new Date(value).toLocaleString("fr-FR") : "-";
}

export function TelegramAdminModule({ initialPayload }: { initialPayload: BotAdminPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/bot/telegram/admin");
    if (!response.ok) return toast.error("Actualisation impossible.");
    setPayload((await response.json()) as BotAdminPayload);
  }

  async function retry(errorId: string) {
    setRetrying(errorId);
    const response = await fetch("/api/bot/telegram/admin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ errorId }),
    });
    setRetrying(null);
    if (!response.ok) return toast.error("Relance impossible.");
    toast.success("Relance enregistree.");
    await refresh();
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Bot Telegram</h1>
          <p className="text-muted-foreground text-sm">Liaisons, activite, conversations et erreurs techniques.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh}>
          <RefreshCw data-icon="inline-start" />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Comptes lies" value={payload.accounts.filter((item) => item.status === "connected").length} />
        <Metric label="Conversations" value={payload.conversations.length} />
        <Metric label="Messages journalises" value={payload.messages.length} />
        <Metric label="Erreurs ouvertes" value={payload.errors.filter((item) => item.status === "open").length} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-sm">Liaisons Telegram</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profil</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Derniere activite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.accounts.map((account) => (
                <TableRow key={text(account.id)}>
                  <TableCell className="font-medium">{text(account.profile_id)}</TableCell>
                  <TableCell>{text(account.organization_id)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{text(account.status)}</Badge>
                  </TableCell>
                  <TableCell>{date(account.last_activity_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {payload.accounts.length === 0 ? (
            <EmptyState title="Aucune liaison" description="Aucun compte Telegram n est actuellement lie." />
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-sm">Erreurs et relances</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payload.errors.map((error) => (
                <TableRow key={text(error.id)}>
                  <TableCell className="font-medium">{text(error.error_code)}</TableCell>
                  <TableCell>{text(error.safe_message)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{text(error.status)}</Badge>
                  </TableCell>
                  <TableCell>{date(error.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={retrying === error.id || error.status === "resolved"}
                      onClick={() => retry(text(error.id))}
                    >
                      <RefreshCw data-icon="inline-start" />
                      Relancer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {payload.errors.length === 0 ? (
            <EmptyState title="Aucune erreur" description="Aucune erreur Telegram n est en attente." />
          ) : null}
        </div>
      </section>
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
