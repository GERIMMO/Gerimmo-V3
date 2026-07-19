"use client";

import { useState } from "react";

import { BadgeCheck, FileCheck2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ArtisanValidationRow, ArtisanValidationStatus } from "@/services/artisan-validation-service";

const statusLabel: Record<ArtisanValidationStatus, string> = {
  en_attente: "En attente",
  valide: "Validé",
  refuse: "Refusé",
};

const statusVariant: Record<ArtisanValidationStatus, "secondary" | "default" | "destructive"> = {
  en_attente: "secondary",
  valide: "default",
  refuse: "destructive",
};

export function ContractorValidationConsole({ initialArtisans }: { initialArtisans: ArtisanValidationRow[] }) {
  const [artisans, setArtisans] = useState(initialArtisans);
  const [pending, setPending] = useState<string | null>(null);

  async function decide(profileId: string, status: ArtisanValidationStatus) {
    setPending(profileId);
    const response = await fetch("/api/admin/contractor-validation", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, status }),
    });
    setPending(null);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return toast.error(body.message ?? "Mise à jour impossible.");
    }
    setArtisans((current) =>
      current.map((artisan) =>
        artisan.profile_id === profileId ? { ...artisan, status, reviewed_at: new Date().toISOString() } : artisan,
      ),
    );
    toast.success(
      status === "valide" ? "Artisan validé." : status === "refuse" ? "Artisan refusé." : "Statut réinitialisé.",
    );
  }

  const counts = {
    en_attente: artisans.filter((artisan) => artisan.status === "en_attente").length,
    valide: artisans.filter((artisan) => artisan.status === "valide").length,
    refuse: artisans.filter((artisan) => artisan.status === "refuse").length,
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <FileCheck2 className="text-primary" />
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">Validation des artisans</h1>
          <p className="text-muted-foreground text-sm">
            Contrôle des justificatifs légaux et administratifs avant activation d’un artisan.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="En attente" value={counts.en_attente} />
        <Metric label="Validés" value={counts.valide} />
        <Metric label="Refusés" value={counts.refuse} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artisan</TableHead>
              <TableHead>Organisation</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Décision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {artisans.map((artisan) => (
              <TableRow key={artisan.profile_id}>
                <TableCell className="font-medium">
                  {artisan.full_name ?? artisan.email ?? artisan.profile_id}
                </TableCell>
                <TableCell>{artisan.organization_name ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{artisan.email ?? artisan.phone ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[artisan.status]}>{statusLabel[artisan.status]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending === artisan.profile_id || artisan.status === "valide"}
                      onClick={() => decide(artisan.profile_id, "valide")}
                    >
                      <BadgeCheck data-icon="inline-start" />
                      Valider
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending === artisan.profile_id || artisan.status === "refuse"}
                      onClick={() => decide(artisan.profile_id, "refuse")}
                    >
                      <XCircle data-icon="inline-start" />
                      Refuser
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {artisans.length === 0 ? (
          <Empty className="border-0 py-8">
            <EmptyHeader>
              <EmptyTitle>Aucun artisan</EmptyTitle>
              <EmptyDescription>Aucun artisan n’est encore enregistré dans le réseau.</EmptyDescription>
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
