"use client";

import { useMemo, useRef, useState } from "react";
import { Archive, Download, FileText, History, Mail, Printer, RotateCcw, Search, Send, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Doc = {
  id: string;
  title: string;
  reference: string;
  category: string;
  status: "brouillon" | "actif" | "envoye" | "archive";
  visibility: string;
  version: number;
  expiresAt: string | null;
  fileName: string;
  size: number;
  history: string[];
};

const templates = ["Rapport d incident", "Quittance", "Bon d intervention", "Courrier", "Devis", "Compte rendu"];
const categories = ["Rapports", "Quittances", "Interventions", "Courriers", "Devis"];

const initialDocs: Doc[] = [
  {
    id: "doc-1",
    title: "Rapport d incident - Degat des eaux",
    reference: "DOC-2026-0001",
    category: "Rapports",
    status: "actif",
    visibility: "Agence",
    version: 2,
    expiresAt: "2026-09-30",
    fileName: "rapport-incident.pdf",
    size: 184000,
    history: ["Creation", "Version 2"],
  },
  {
    id: "doc-2",
    title: "Quittance - Juillet 2026",
    reference: "DOC-2026-0002",
    category: "Quittances",
    status: "brouillon",
    visibility: "Locataire",
    version: 1,
    expiresAt: null,
    fileName: "quittance-juillet.pdf",
    size: 96000,
    history: ["Creation depuis modele"],
  },
];

function statusLabel(status: Doc["status"]) {
  return { brouillon: "Brouillon", actif: "Actif", envoye: "Envoye", archive: "Archive" }[status];
}

function pdfUrl(doc: Doc) {
  const body = `%PDF-1.3\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n4 0 obj << /Length 130 >> stream\nBT /F1 18 Tf 72 720 Td (GERIMMO V3) Tj 0 -32 Td (${doc.title.slice(0, 42)}) Tj 0 -28 Td (${doc.reference}) Tj ET\nendstream endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF`;
  return `data:application/pdf;base64,${btoa(body)}`;
}

export function DocumentsModule() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState(initialDocs);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [selectedId, setSelectedId] = useState("doc-1");
  const selected = docs.find((doc) => doc.id === selectedId) ?? null;
  const filtered = useMemo(
    () => docs.filter((doc) => `${doc.title} ${doc.reference}`.toLowerCase().includes(query.toLowerCase()) && (category === "Toutes" || doc.category === category)),
    [category, docs, query]
  );

  function updateSelected(patch: Partial<Doc>, event: string) {
    if (!selected) return;
    setDocs((current) => current.map((doc) => (doc.id === selected.id ? { ...doc, ...patch, history: [event, ...doc.history] } : doc)));
  }

  function upload(file: File) {
    const doc: Doc = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^.]+$/, ""),
      reference: `DOC-${new Date().getFullYear()}-${String(docs.length + 1).padStart(4, "0")}`,
      category: category === "Toutes" ? "Courriers" : category,
      status: "actif",
      visibility: "Organisation",
      version: 1,
      expiresAt: null,
      fileName: file.name,
      size: file.size,
      history: ["Upload"],
    };
    setDocs((current) => [doc, ...current]);
    setSelectedId(doc.id);
  }

  function createFromTemplate(name: string) {
    const doc: Doc = {
      id: crypto.randomUUID(),
      title: name,
      reference: `DOC-${new Date().getFullYear()}-${String(docs.length + 1).padStart(4, "0")}`,
      category: name === "Quittance" ? "Quittances" : name === "Devis" ? "Devis" : "Courriers",
      status: "brouillon",
      visibility: name === "Quittance" ? "Locataire" : "Agence",
      version: 1,
      expiresAt: null,
      fileName: `${name.toLowerCase().replaceAll(" ", "-")}.pdf`,
      size: 0,
      history: ["Creation depuis modele", "Pre-remplissage agence/proprietaire prepare"],
    };
    setDocs((current) => [doc, ...current]);
    setSelectedId(doc.id);
  }

  function download() {
    if (!selected) return;
    const link = document.createElement("a");
    link.href = pdfUrl(selected);
    link.download = selected.fileName;
    link.click();
    updateSelected({}, "Telechargement");
  }

  function printDocument() {
    if (!selected) return;
    window.open(pdfUrl(selected), "_blank", "noopener,noreferrer")?.print();
    updateSelected({}, "Impression");
  }

  function sendDocument() {
    if (!selected) return;
    updateSelected({ status: "envoye" }, "Envoi mail prepare");
    window.location.href = `mailto:?subject=${encodeURIComponent(selected.title)}&body=${encodeURIComponent("Document GERIMMO pret a envoyer.")}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Documents</h1>
          <p className="text-muted-foreground text-sm">Bibliotheque documentaire officielle GERIMMO V3.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} className="hidden" type="file" accept="application/pdf" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />Importer</Button>
          <Button onClick={() => createFromTemplate("Courrier")}><FileText />Nouveau</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Actifs</CardTitle></CardHeader><CardContent className="font-semibold text-2xl">{docs.filter((doc) => doc.status === "actif").length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Modeles</CardTitle></CardHeader><CardContent className="font-semibold text-2xl">{templates.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Alertes</CardTitle></CardHeader><CardContent className="font-semibold text-2xl">1</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Archives</CardTitle></CardHeader><CardContent className="font-semibold text-2xl">{docs.filter((doc) => doc.status === "archive").length}</CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Rechercher" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select className="h-9 rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option>Toutes</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden">
          <Table><TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Categorie</TableHead><TableHead>Version</TableHead><TableHead>Droits</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{filtered.map((doc) => <TableRow key={doc.id} className="cursor-pointer" onClick={() => setSelectedId(doc.id)}><TableCell><div className="font-medium">{doc.title}</div><div className="text-muted-foreground text-xs">{doc.reference}</div></TableCell><TableCell>{doc.category}</TableCell><TableCell>v{doc.version}</TableCell><TableCell>{doc.visibility}</TableCell><TableCell><Badge>{statusLabel(doc.status)}</Badge></TableCell></TableRow>)}</TableBody></Table>
        </Card>
        {selected ? <Card><CardHeader><CardTitle className="text-base">Visualiseur PDF GERIMMO</CardTitle></CardHeader><CardContent className="flex flex-col gap-3"><iframe className="h-72 rounded-md border" title="Visualiseur PDF GERIMMO" src={pdfUrl(selected)} /><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={download}><Download />Telecharger</Button><Button variant="outline" onClick={printDocument}><Printer />Imprimer</Button><Button variant="outline" onClick={sendDocument}><Send />Envoyer</Button><Button variant="outline" onClick={() => updateSelected({ version: selected.version + 1 }, "Nouvelle version")}><History />Versionner</Button></div><Button variant="secondary" onClick={() => updateSelected(selected.status === "archive" ? { status: "actif" } : { status: "archive" }, selected.status === "archive" ? "Restauration" : "Archivage")}>{selected.status === "archive" ? <RotateCcw /> : <Archive />}{selected.status === "archive" ? "Restaurer" : "Archiver"}</Button></CardContent></Card> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">{templates.map((template) => <Button key={template} variant="outline" onClick={() => createFromTemplate(template)}>{template}</Button>)}</div>

      {selected ? <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId("")}><SheetContent className="overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle>{selected.title}</SheetTitle></SheetHeader><div className="grid gap-4 px-4 pb-6 text-sm"><iframe className="h-80 rounded-md border" title="PDF officiel GERIMMO" src={pdfUrl(selected)} /><div className="rounded-md border p-3">Pre-remplissage : agence GERIMMO, proprietaire personnalisable.</div><div className="rounded-md border p-3">Droits : {selected.visibility}. RLS Supabase active.</div><div className="rounded-md border p-3">Alerte expiration : {selected.expiresAt ?? "aucune"}.</div><div className="rounded-md border p-3">Mail prepare. Contexte bot conserve sans developper le bot.</div><div className="grid gap-2">{selected.history.map((item) => <div key={item} className="rounded-md border p-2">{item}</div>)}</div><Button variant="outline"><Mail />Envoi par e-mail prepare</Button></div></SheetContent></Sheet> : null}
    </div>
  );
}
