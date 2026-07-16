"use client";

import { type FormEvent, useMemo, useState } from "react";

import { Archive, Download, FileText, LoaderCircle, RotateCcw, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocumentsPayload, DocumentType, GerimmoDocument } from "@/types/documents";

const statusLabels = { brouillon: "Brouillon", actif: "Actif", envoye: "Envoyé", expire: "Expiré", archive: "Archivé" };
const visibilityLabels = {
  organisation: "Organisation",
  agence: "Agence",
  proprietaire: "Propriétaire",
  locataire: "Locataire",
  artisan: "Artisan",
  prive: "Privé",
};
const documentTypeLabels: Record<DocumentType, string> = {
  rapport_incident: "Rapport d’incident",
  quittance: "Quittance",
  bon_intervention: "Bon d’intervention",
  courrier: "Courrier",
  devis: "Devis",
  compte_rendu: "Compte rendu",
  contrat: "Contrat",
  attestation: "Attestation",
  autre: "Autre document",
};

export function DocumentsModule({ initialPayload }: { initialPayload: DocumentsPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialPayload.documents.at(0)?.id ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState<"organisation" | "proprietaire">("proprietaire");
  const [ownerId, setOwnerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("autre");
  const [expiresAt, setExpiresAt] = useState("");
  const selected = payload.documents.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      payload.documents.filter((item) => `${item.title} ${item.reference}`.toLowerCase().includes(query.toLowerCase())),
    [payload.documents, query],
  );
  const ownerNames = useMemo(() => new Map(payload.owners.map((owner) => [owner.id, owner.name])), [payload.owners]);
  const availableProperties = useMemo(() => {
    if (!ownerId) return payload.properties;
    const owned = payload.properties.filter((property) => property.owner_profile_ids.includes(ownerId));
    return owned.length > 0 ? owned : payload.properties;
  }, [ownerId, payload.properties]);

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

  function resetImport() {
    setFile(null);
    setTitle("");
    setDestination("proprietaire");
    setOwnerId("");
    setPropertyId("");
    setCategoryId("");
    setDocumentType("autre");
    setExpiresAt("");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload.organizationId) return toast.error("Aucune organisation active.");
    if (!file) return toast.error("Sélectionnez un fichier.");
    if (!title.trim()) return toast.error("Saisissez un titre.");
    if (destination === "proprietaire" && !ownerId) return toast.error("Sélectionnez le propriétaire.");

    setIsUploading(true);
    const form = new FormData();
    form.set("file", file);
    form.set("organization_id", payload.organizationId);
    form.set("title", title.trim());
    form.set("visibility", destination);
    form.set("document_type", documentType);
    if (destination === "proprietaire") form.set("owner_profile_id", ownerId);
    if (propertyId) form.set("bien_id", propertyId);
    if (categoryId) form.set("category_id", categoryId);
    if (expiresAt) form.set("expires_at", new Date(`${expiresAt}T23:59:59`).toISOString());

    try {
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const responsePayload = (await response.json()) as GerimmoDocument | { message?: string };
      if (!response.ok) {
        throw new Error("message" in responsePayload ? responsePayload.message : "Import impossible.");
      }
      const created = responsePayload as GerimmoDocument;
      await reload();
      setSelectedId(created.id);
      setImportOpen(false);
      resetImport();
      toast.success("Document importé et classé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      setIsUploading(false);
    }
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
        <Button size="sm" onClick={() => setImportOpen(true)} disabled={!payload.organizationId}>
          <Upload data-icon="inline-start" />
          Importer
        </Button>
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
                    <TableCell>
                      <div>{visibilityLabels[document.visibility]}</div>
                      {document.owner_profile_id && (
                        <div className="text-muted-foreground text-xs">
                          {ownerNames.get(document.owner_profile_id) ?? "Propriétaire rattaché"}
                        </div>
                      )}
                    </TableCell>
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
      <Sheet
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open && !isUploading) resetImport();
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <form className="flex min-h-full flex-col" onSubmit={upload}>
            <SheetHeader>
              <SheetTitle>Importer un document</SheetTitle>
              <SheetDescription>
                Classez le fichier dans l’organisation et rattachez-le à son destinataire.
              </SheetDescription>
            </SheetHeader>
            <FieldGroup className="px-4 py-2">
              <Field>
                <FieldLabel htmlFor="document-file">Fichier</FieldLabel>
                <Input
                  id="document-file"
                  type="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    if (nextFile && !title) setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
                  }}
                />
                <FieldDescription>PDF, JPG, PNG ou WebP. Taille maximale : 20 Mo.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="document-title">Titre</FieldLabel>
                <Input
                  id="document-title"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ex. Bail signé"
                />
              </Field>
              <Field>
                <FieldLabel>Destinataire</FieldLabel>
                <Select value={destination} onValueChange={(value) => setDestination(value as typeof destination)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="proprietaire">Propriétaire bailleur</SelectItem>
                      <SelectItem value="organisation">Organisation uniquement</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {destination === "proprietaire" && (
                <Field data-invalid={!ownerId && Boolean(file)}>
                  <FieldLabel>Propriétaire</FieldLabel>
                  <Select
                    value={ownerId}
                    onValueChange={(value) => {
                      setOwnerId(value);
                      setPropertyId("");
                    }}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!ownerId && Boolean(file)}>
                      <SelectValue placeholder="Choisir un propriétaire" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {payload.owners.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            {owner.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {payload.owners.length === 0 && (
                    <FieldDescription>Aucun propriétaire actif n’est rattaché à cette organisation.</FieldDescription>
                  )}
                </Field>
              )}
              <Field>
                <FieldLabel>Bien concerné</FieldLabel>
                <Select
                  value={propertyId || "none"}
                  onValueChange={(value) => setPropertyId(value === "none" ? "" : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Aucun bien précis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">Aucun bien précis</SelectItem>
                      {availableProperties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.reference} · {property.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Type de document</FieldLabel>
                <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(documentTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {payload.categories.length > 0 && (
                <Field>
                  <FieldLabel>Catégorie</FieldLabel>
                  <Select
                    value={categoryId || "none"}
                    onValueChange={(value) => setCategoryId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sans catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Sans catégorie</SelectItem>
                        {payload.categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="document-expiration">Date d’expiration</FieldLabel>
                <Input
                  id="document-expiration"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
                <FieldDescription>Facultative. Elle alimentera les alertes documentaires.</FieldDescription>
              </Field>
            </FieldGroup>
            <SheetFooter>
              <Button
                type="submit"
                disabled={
                  isUploading ||
                  !payload.organizationId ||
                  (payload.owners.length === 0 && destination === "proprietaire")
                }
              >
                {isUploading ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Upload data-icon="inline-start" />
                )}
                {isUploading ? "Import en cours" : "Importer et classer"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
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
