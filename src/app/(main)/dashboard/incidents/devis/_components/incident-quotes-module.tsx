"use client";

import { useMemo, useState } from "react";
import { Archive, Check, Eye, FileText, History, Plus, Send, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ArtisanScope, IncidentQuote, IncidentQuoteEvent, IncidentQuoteRecipient, IncidentQuoteRequest, QuoteStatus } from "@/types/incident-quotes";

const now = new Date().toISOString();
const futureLinks = { validation: null, planification: null, intervention: null };
const incidents = [
  { id: "inc-1", label: "INC-2026-000001 - Fuite cuisine" },
  { id: "inc-2", label: "INC-2026-000002 - Eclairage palier" },
];
const artisans = [
  { id: "art-1", name: "Atelier Martin", email: "contact@atelier-martin.test", scope: "prive" as ArtisanScope },
  { id: "art-2", name: "GERIMMO Plomberie Validee", email: "plomberie@gerimmo.test", scope: "gerimmo_valide" as ArtisanScope },
  { id: "art-3", name: "GERIMMO Electricite Validee", email: "electricite@gerimmo.test", scope: "gerimmo_valide" as ArtisanScope },
];

const initialRequests: IncidentQuoteRequest[] = [
  {
    id: "qr-1",
    organization_id: "org-demo",
    incident_id: "inc-1",
    requested_by: "profile-1",
    title: "Devis fuite cuisine",
    description: "Demande de chiffrage pour fuite sous evier.",
    status: "demande",
    allow_single_private_artisan: false,
    sent_at: null,
    expires_at: "2026-08-15T12:00:00.000Z",
    future_links: futureLinks,
    metadata: {},
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
];

const initialRecipients: IncidentQuoteRecipient[] = [
  { id: "rec-1", organization_id: "org-demo", quote_request_id: "qr-1", artisan_profile_id: "art-1", artisan_name: "Atelier Martin", artisan_email: "contact@atelier-martin.test", artisan_scope: "prive", status: "demande", sent_at: null, responded_at: null, declined_reason: null, metadata: {}, created_at: now, updated_at: now, archived_at: null },
  { id: "rec-2", organization_id: "org-demo", quote_request_id: "qr-1", artisan_profile_id: "art-2", artisan_name: "GERIMMO Plomberie Validee", artisan_email: "plomberie@gerimmo.test", artisan_scope: "gerimmo_valide", status: "demande", sent_at: null, responded_at: null, declined_reason: null, metadata: {}, created_at: now, updated_at: now, archived_at: null },
];

const initialEvents: IncidentQuoteEvent[] = [
  { id: "evt-1", organization_id: "org-demo", quote_request_id: "qr-1", recipient_id: null, quote_id: null, actor_profile_id: "profile-1", action: "CREATE", old_values: null, new_values: null, metadata: {}, created_at: now },
];

const statusLabels: Record<QuoteStatus, string> = {
  demande: "Demande",
  recu: "Recu",
  refuse: "Refuse",
  expire: "Expire",
  retenu: "Retenu",
};

type QuoteForm = {
  incident_id: string;
  title: string;
  description: string;
  allow_single_private_artisan: boolean;
  artisanIds: string[];
};

const emptyForm: QuoteForm = {
  incident_id: incidents[0].id,
  title: "",
  description: "",
  allow_single_private_artisan: false,
  artisanIds: [artisans[0].id, artisans[1].id],
};

export function IncidentQuotesModule() {
  const [requests, setRequests] = useState(initialRequests);
  const [recipients, setRecipients] = useState(initialRecipients);
  const [quotes, setQuotes] = useState<IncidentQuote[]>([]);
  const [events, setEvents] = useState(initialEvents);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(initialRequests[0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selected = requests.find((request) => request.id === selectedId) ?? null;
  const selectedRecipients = recipients.filter((recipient) => recipient.quote_request_id === selected?.id);
  const selectedQuotes = quotes.filter((quote) => quote.quote_request_id === selected?.id);
  const selectedEvents = events.filter((event) => event.quote_request_id === selected?.id);
  const canSend = form.artisanIds.length >= 2 || (form.allow_single_private_artisan && form.artisanIds.length === 1 && artisans.find((artisan) => artisan.id === form.artisanIds[0])?.scope === "prive");

  const rows = useMemo(
    () =>
      requests.map((request) => ({
        request,
        incident: incidents.find((incident) => incident.id === request.incident_id)?.label ?? "Incident",
        recipients: recipients.filter((recipient) => recipient.quote_request_id === request.id),
        quotes: quotes.filter((quote) => quote.quote_request_id === request.id),
      })),
    [quotes, recipients, requests]
  );

  function addEvent(requestId: string, action: string, recipientId?: string | null, quoteId?: string | null) {
    setEvents((current) => [{ id: crypto.randomUUID(), organization_id: "org-demo", quote_request_id: requestId, recipient_id: recipientId ?? null, quote_id: quoteId ?? null, actor_profile_id: "profile-1", action, old_values: null, new_values: null, metadata: {}, created_at: new Date().toISOString() }, ...current]);
  }

  function createRequest() {
    if (!canSend || !form.title.trim()) {
      return;
    }
    const createdAt = new Date().toISOString();
    const request: IncidentQuoteRequest = {
      id: crypto.randomUUID(),
      organization_id: "org-demo",
      incident_id: form.incident_id,
      requested_by: "profile-1",
      title: form.title,
      description: form.description || null,
      status: "demande",
      allow_single_private_artisan: form.allow_single_private_artisan,
      sent_at: null,
      expires_at: null,
      future_links: futureLinks,
      metadata: {},
      created_at: createdAt,
      updated_at: createdAt,
      archived_at: null,
    };
    const nextRecipients = artisans
      .filter((artisan) => form.artisanIds.includes(artisan.id))
      .map((artisan) => ({
        id: crypto.randomUUID(),
        organization_id: request.organization_id,
        quote_request_id: request.id,
        artisan_profile_id: artisan.id,
        artisan_name: artisan.name,
        artisan_email: artisan.email,
        artisan_scope: artisan.scope,
        status: "demande" as QuoteStatus,
        sent_at: null,
        responded_at: null,
        declined_reason: null,
        metadata: {},
        created_at: createdAt,
        updated_at: createdAt,
        archived_at: null,
      }));
    setRequests((current) => [request, ...current]);
    setRecipients((current) => [...nextRecipients, ...current]);
    setSelectedId(request.id);
    addEvent(request.id, "CREATE");
    setForm(emptyForm);
    setDrawerOpen(true);
  }

  function sendRequest() {
    if (!selected) {
      return;
    }
    setRequests((current) => current.map((request) => (request.id === selected.id ? { ...request, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() } : request)));
    setRecipients((current) => current.map((recipient) => (recipient.quote_request_id === selected.id ? { ...recipient, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() } : recipient)));
    addEvent(selected.id, "SEND");
  }

  function receiveQuote(recipient: IncidentQuoteRecipient) {
    const createdAt = new Date().toISOString();
    const quote: IncidentQuote = {
      id: crypto.randomUUID(),
      organization_id: recipient.organization_id,
      quote_request_id: recipient.quote_request_id,
      recipient_id: recipient.id,
      amount_cents: 125000 + quotes.length * 35000,
      currency: "EUR",
      received_at: createdAt,
      valid_until: "2026-08-31",
      file_name: `devis-${recipient.artisan_name.toLowerCase().replaceAll(" ", "-")}.pdf`,
      storage_path: null,
      notes: "Devis recu et pret a comparer.",
      status: "recu",
      metadata: {},
      created_at: createdAt,
      updated_at: createdAt,
      archived_at: null,
    };
    setQuotes((current) => [quote, ...current]);
    setRecipients((current) => current.map((item) => (item.id === recipient.id ? { ...item, status: "recu", responded_at: createdAt, updated_at: createdAt } : item)));
    setRequests((current) => current.map((request) => (request.id === recipient.quote_request_id ? { ...request, status: "recu", updated_at: createdAt } : request)));
    addEvent(recipient.quote_request_id, "QUOTE_RECEIVED", recipient.id, quote.id);
  }

  function retainQuote(quote: IncidentQuote) {
    setQuotes((current) => current.map((item) => (item.quote_request_id === quote.quote_request_id ? { ...item, status: item.id === quote.id ? "retenu" : "recu" } : item)));
    setRequests((current) => current.map((request) => (request.id === quote.quote_request_id ? { ...request, status: "retenu", updated_at: new Date().toISOString() } : request)));
    setRecipients((current) => current.map((recipient) => (recipient.quote_request_id === quote.quote_request_id ? { ...recipient, status: recipient.id === quote.recipient_id ? "retenu" : recipient.status } : recipient)));
    addEvent(quote.quote_request_id, "QUOTE_SELECTED", quote.recipient_id, quote.id);
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-normal">Demandes de devis</h1>
          <p className="text-muted-foreground text-sm">Selection artisans, envoi des demandes, reception et comparaison des devis.</p>
        </div>
        <Button onClick={createRequest} disabled={!canSend || !form.title.trim()}>
          <Plus className="size-4" />
          Creer la demande
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle demande</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-2 text-sm">
              Incident
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.incident_id} onChange={(event) => setForm({ ...form, incident_id: event.target.value })}>
                {incidents.map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    {incident.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm" htmlFor="quote-title">
              Objet
              <Input id="quote-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex: Devis plomberie fuite" />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="quote-description">
              Description
              <Textarea id="quote-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Preciser le besoin a chiffrer." />
            </label>
            <div className="grid gap-2">
              <p className="text-sm">Artisans destinataires</p>
              {artisans.map((artisan) => (
                <label key={artisan.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.artisanIds.includes(artisan.id)}
                    onChange={(event) => {
                      const artisanIds = event.target.checked ? [...form.artisanIds, artisan.id] : form.artisanIds.filter((id) => id !== artisan.id);
                      setForm({ ...form, artisanIds });
                    }}
                  />
                  <span className="flex-1">{artisan.name}</span>
                  <Badge variant="outline">{artisan.scope === "prive" ? "Prive" : "GERIMMO valide"}</Badge>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allow_single_private_artisan} onChange={(event) => setForm({ ...form, allow_single_private_artisan: event.target.checked })} />
              Choix explicite d un seul artisan prive
            </label>
            {!canSend ? <p className="text-muted-foreground text-sm">Deux artisans minimum sont requis, sauf choix explicite d un seul artisan prive.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tableau des demandes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Demande</TableHead>
                  <TableHead>Incident</TableHead>
                  <TableHead>Artisans</TableHead>
                  <TableHead>Devis recus</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ request, incident, recipients: rowRecipients, quotes: rowQuotes }) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>{incident}</TableCell>
                    <TableCell>{rowRecipients.length}</TableCell>
                    <TableCell>{rowQuotes.length}</TableCell>
                    <TableCell>{statusLabels[request.status]}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedId(request.id);
                          setDrawerOpen(true);
                        }}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 grid gap-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Incident" value={incidents.find((incident) => incident.id === selected.incident_id)?.label ?? "Incident"} />
                  <Info label="Statut" value={statusLabels[selected.status]} />
                  <Info label="Envoye le" value={selected.sent_at ? new Date(selected.sent_at).toLocaleString("fr-FR") : "Non envoye"} />
                  <Info label="Regle 2 devis" value={selected.allow_single_private_artisan ? "Exception artisan prive" : "Deux devis minimum"} />
                </div>
                <DrawerBlock icon={<Wrench className="size-4" />} title="Artisans destinataires">
                  {selectedRecipients.map((recipient) => (
                    <div key={recipient.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span>{recipient.artisan_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{recipient.artisan_scope === "prive" ? "Prive" : "GERIMMO valide"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => receiveQuote(recipient)}>
                          Recevoir
                        </Button>
                      </div>
                    </div>
                  ))}
                </DrawerBlock>
                <DrawerBlock icon={<FileText className="size-4" />} title="Devis recus">
                  {selectedQuotes.length ? (
                    selectedQuotes.map((quote) => (
                      <div key={quote.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <span>{(quote.amount_cents / 100).toLocaleString("fr-FR", { style: "currency", currency: quote.currency })}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{statusLabels[quote.status]}</Badge>
                          <Button variant="outline" size="sm" onClick={() => retainQuote(quote)}>
                            <Check className="size-4" />
                            Retenir
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Aucun devis recu.</p>
                  )}
                </DrawerBlock>
                <DrawerBlock icon={<Send className="size-4" />} title="Rattachements futurs prepares">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <Badge variant="outline">Validation: pret</Badge>
                    <Badge variant="outline">Planification: pret</Badge>
                    <Badge variant="outline">Intervention: pret</Badge>
                  </div>
                </DrawerBlock>
                <DrawerBlock icon={<History className="size-4" />} title="Historique">
                  {selectedEvents.map((event) => (
                    <div key={event.id} className="flex justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="font-medium">{event.action}</span>
                      <span className="text-muted-foreground">{new Date(event.created_at).toLocaleString("fr-FR")}</span>
                    </div>
                  ))}
                </DrawerBlock>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={sendRequest}>
                    <Send className="size-4" />
                    Envoyer
                  </Button>
                  <Button variant="outline" onClick={() => setRequests((current) => current.map((request) => (request.id === selected.id ? { ...request, status: "expire", archived_at: new Date().toISOString() } : request)))}>
                    <Archive className="size-4" />
                    Archiver
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function DrawerBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <p className="font-medium text-sm">{title}</p>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}
