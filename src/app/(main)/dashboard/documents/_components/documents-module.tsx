"use client";

import { useMemo, useRef, useState } from "react";

import { Archive, Download, FileText, RotateCcw, Search, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocumentsPayload, GerimmoDocument } from "@/types/documents";

const statusLabels = { brouillon: "Brouillon", actif: "Actif", envoye: "Envoyé", expire: "Expiré", archive: "Archivé" };

export function DocumentsModule({
  initialPayload,
  organizationId,
}: {
  initialPayload: DocumentsPayload;
  organizationId: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialPayload.documents[0]?.id ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const selected = payload.documents.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      payload.documents.filter((item) => `${item.title} ${item.reference}`.toLowerCase().includes(query.toLowerCase())),
    [payload.documents, query],
  );

  async function reload() {
    const response = await fetch("/api/documents", { cache: "no-store" });
    if (!response.ok) throw new Error("Actualisation impossible.");
    setPayload((await response.json()) as DocumentsPayload);
  }

  async function openDocument(document: GerimmoDocument) {
    setSelectedId(document.id);
    setPreviewUrl(null);
    if (!document.storage_path) return;
    const response = await fetch(`/api/documents/${document.id}`);
    if (response.ok) setPreviewUrl(((await response.json()) as { url: string }).url);
  }

  async function upload(file: File) {
    if (!organizationId) throw new Error("Aucune organisation active.");
    const form = new FormData();
    form.set("file", file);
    form.set("organization_id", organizationId);
    form.set("title", file.name.replace(/\.[^.]+$/, ""));
    const response = await fetch("/api/documents", { method: "POST", body: form });
    if (!response.ok) throw new Error("Import impossible.");
    const created = (await response.json()) as GerimmoDocument;
    await reload();
    setSelectedId(created.id);
  }

  async function setArchive(archive: boolean) {
    if (!selected) return;
    const response = await fetch(`/api/documents/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: archive ? "archive" : "restore" }),
    });
    if (!response.ok) throw new Error("Action impossible.");
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Documents</h1>
          <p className="text-muted-foreground text-sm">Bibliothèque sécurisée GERIMMO.</p>
        </div>
        <div>
          <input
            ref={fileRef}
            className="hidden"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])}
          />
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Upload data-icon="inline-start" />
            Importer
          </Button>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Documents" value={payload.documents.length} />
        <Metric label="Alertes" value={payload.alerts.filter((item) => item.status === "a_traiter").length} />
        <Metric label="Archives" value={payload.documents.filter((item) => item.status === "archive").length} />
      </div>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher par titre ou référence"
        />
      </div>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Visibilité</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((document) => (
                  <TableRow key={document.id} className="cursor-pointer" onClick={() => openDocument(document)}>
                    <TableCell>
                      <div className="font-medium">{document.title}</div>
                      <div className="text-muted-foreground text-xs">{document.reference}</div>
                    </TableCell>
                    <TableCell>{document.document_type.replaceAll("_", " ")}</TableCell>
                    <TableCell>v{document.current_version}</TableCell>
                    <TableCell>{document.visibility}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabels[document.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <FileText />
                <EmptyTitle>Aucun document</EmptyTitle>
                <EmptyDescription>Importez le premier document de cette organisation.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId("")}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {selected.reference} · version {selected.current_version}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-6">
                {previewUrl ? (
                  <iframe src={previewUrl} title={selected.title} className="h-[60vh] rounded-md border" />
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <FileText />
                      <EmptyTitle>Aucun aperçu</EmptyTitle>
                      <EmptyDescription>Le document ne possède pas encore de fichier.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                <div className="flex flex-wrap gap-2">
                  {previewUrl && (
                    <Button asChild variant="outline">
                      <a href={previewUrl} download={selected.file_name ?? undefined}>
                        <Download data-icon="inline-start" />
                        Télécharger
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setArchive(selected.status !== "archive")}>
                    {selected.status === "archive" ? (
                      <RotateCcw data-icon="inline-start" />
                    ) : (
                      <Archive data-icon="inline-start" />
                    )}
                    {selected.status === "archive" ? "Restaurer" : "Archiver"}
                  </Button>
                </div>
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
