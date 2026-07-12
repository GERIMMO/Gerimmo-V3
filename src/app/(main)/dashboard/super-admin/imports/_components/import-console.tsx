"use client";

import { useRef, useState } from "react";

import { FileSpreadsheet, Play, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportJob, ImportPreview } from "@/types/administration";

export function ImportConsole({ initialJobs }: { initialJobs: ImportJob[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState(initialJobs);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/admin/imports", { method: "POST", body: form });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(data.message ?? "Analyse impossible.");
    setPreview(data as ImportPreview);
  }

  async function execute() {
    if (!preview) return;
    setBusy(true);
    const response = await fetch("/api/admin/imports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: preview.job.id }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return toast.error(data.message ?? "Import impossible.");
    setJobs((current) => [data as ImportJob, ...current.filter((job) => job.id !== data.id)]);
    setPreview(null);
    toast.success("Import exécuté.");
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-semibold text-2xl">Import initial</h1>
        <p className="text-muted-foreground text-sm">Agences, propriétaires, biens et locataires.</p>
      </header>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="text-primary" />
            <div>
              <div className="font-medium">CSV ou Excel</div>
              <div className="text-muted-foreground text-xs">Colonne obligatoire : entity_type</div>
            </div>
          </div>
          <input
            ref={input}
            className="hidden"
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])}
          />
          <Button disabled={busy} onClick={() => input.current?.click()}>
            <Upload data-icon="inline-start" />
            Analyser
          </Button>
        </CardContent>
      </Card>
      {preview && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Aperçu · {preview.job.file_name}</CardTitle>
            <Button disabled={busy || preview.job.valid_rows === 0} onClick={execute}>
              <Play data-icon="inline-start" />
              Importer {preview.job.valid_rows} lignes
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2 text-sm">
              <span>{preview.job.total_rows} lignes</span>
              <span>{preview.job.valid_rows} valides</span>
              <span>{preview.job.duplicate_rows} doublons</span>
              <span>{preview.job.error_rows} erreurs</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Identité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Erreur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.slice(0, 100).map((row) => (
                  <TableRow key={row.row_number}>
                    <TableCell>{row.row_number}</TableCell>
                    <TableCell>{row.entity_type}</TableCell>
                    <TableCell>
                      {String(row.source_data.name || row.source_data.reference || row.source_data.email)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === "valid" ? "default" : "secondary"}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.errors.join(" ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Historique des imports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div key={job.id} className="grid gap-2 border-b pb-3 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-sm">{job.file_name}</span>
                <Badge variant="secondary">{job.status}</Badge>
              </div>
              <Progress value={job.total_rows ? (job.processed_rows / job.total_rows) * 100 : 0} />
              <div className="text-muted-foreground text-xs">
                {job.processed_rows}/{job.total_rows} lignes · {job.error_rows} erreurs
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
