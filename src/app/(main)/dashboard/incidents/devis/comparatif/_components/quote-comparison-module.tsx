"use client";

import { useMemo, useState } from "react";
import { Check, Eye, FileCheck, History, MessageSquare, RotateCcw, Star, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ComparisonDecision, IncidentQuoteComparison, IncidentQuoteComparisonItem, IncidentQuoteValidationEvent } from "@/types/incident-quote-comparisons";

const now = new Date().toISOString();
const futureLinks = { planification: null, intervention: null };

const initialComparison: IncidentQuoteComparison = {
  id: "cmp-1",
  organization_id: "org-demo",
  quote_request_id: "qr-1",
  responsible_profile_id: "profile-1",
  recommended_quote_id: null,
  recommendation_reason: null,
  status: "brouillon",
  future_links: futureLinks,
  metadata: {},
  created_at: now,
  updated_at: now,
  archived_at: null,
};

const initialItems: IncidentQuoteComparisonItem[] = [
  {
    id: "item-1",
    organization_id: "org-demo",
    comparison_id: "cmp-1",
    quote_id: "quote-1",
    recipient_id: "rec-1",
    artisan_name: "Atelier Martin",
    price_cents: 125000,
    announced_delay_days: 4,
    gerimmo_rating: 4.6,
    administrative_documents_valid: true,
    received_at: now,
    comments: "Bon rapport prix / delai.",
    recommendation_score: 0,
    is_recommended: false,
    decision_status: "en_attente",
    decision_comment: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "item-2",
    organization_id: "org-demo",
    comparison_id: "cmp-1",
    quote_id: "quote-2",
    recipient_id: "rec-2",
    artisan_name: "GERIMMO Plomberie Validee",
    price_cents: 149000,
    announced_delay_days: 2,
    gerimmo_rating: 4.9,
    administrative_documents_valid: true,
    received_at: now,
    comments: "Intervention plus rapide.",
    recommendation_score: 0,
    is_recommended: false,
    decision_status: "en_attente",
    decision_comment: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
  {
    id: "item-3",
    organization_id: "org-demo",
    comparison_id: "cmp-1",
    quote_id: "quote-3",
    recipient_id: "rec-3",
    artisan_name: "Entreprise Durand",
    price_cents: 112000,
    announced_delay_days: 8,
    gerimmo_rating: 3.8,
    administrative_documents_valid: false,
    received_at: now,
    comments: "Prix bas mais documents a completer.",
    recommendation_score: 0,
    is_recommended: false,
    decision_status: "en_attente",
    decision_comment: null,
    created_at: now,
    updated_at: now,
    archived_at: null,
  },
];

const initialEvents: IncidentQuoteValidationEvent[] = [
  { id: "evt-1", organization_id: "org-demo", comparison_id: "cmp-1", quote_id: null, actor_profile_id: "profile-1", action: "CREATE", comment: null, metadata: {}, created_at: now },
];

function score(item: Pick<IncidentQuoteComparisonItem, "price_cents" | "gerimmo_rating" | "administrative_documents_valid">) {
  return Number(((1000000 / Math.max(item.price_cents, 1)) * 0.45 + item.gerimmo_rating * 20 * 0.35 + (item.administrative_documents_valid ? 20 : 0)).toFixed(4));
}

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

const decisionLabels: Record<ComparisonDecision, string> = {
  en_attente: "En attente",
  accepte: "Accepte",
  refuse: "Refuse",
  complement: "Complement",
};

export function QuoteComparisonModule() {
  const [comparison, setComparison] = useState(initialComparison);
  const [items, setItems] = useState(() => recommend(initialItems));
  const [events, setEvents] = useState(initialEvents);
  const [selectedQuoteId, setSelectedQuoteId] = useState(items[0].quote_id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comment, setComment] = useState("");

  const selectedItem = items.find((item) => item.quote_id === selectedQuoteId) ?? items[0];
  const recommendedItem = items.find((item) => item.is_recommended) ?? null;
  const orderedItems = useMemo(() => [...items].sort((a, b) => b.recommendation_score - a.recommendation_score), [items]);

  function addEvent(action: string, quoteId?: string | null, eventComment?: string | null) {
    setEvents((current) => [
      {
        id: crypto.randomUUID(),
        organization_id: "org-demo",
        comparison_id: comparison.id,
        quote_id: quoteId ?? null,
        actor_profile_id: "profile-1",
        action,
        comment: eventComment ?? null,
        metadata: {},
        created_at: new Date().toISOString(),
      },
      ...current,
    ]);
  }

  function runRecommendation() {
    const nextItems = recommend(items);
    const recommended = nextItems.find((item) => item.is_recommended) ?? nextItems[0];
    setItems(nextItems);
    setComparison({
      ...comparison,
      recommended_quote_id: recommended.quote_id,
      recommendation_reason: "Recommandation informative selon prix, note GERIMMO et conformite administrative.",
      status: "recommande",
      updated_at: new Date().toISOString(),
    });
    addEvent("RECOMMANDATION", recommended.quote_id, "Calcul automatique GERIMMO.");
  }

  function decide(decision: "accept" | "refuse" | "complement" | "cancel") {
    if (decision === "cancel") {
      setComparison({ ...comparison, status: "annule", updated_at: new Date().toISOString() });
      addEvent("ANNULATION", null, comment || "Procedure annulee.");
      return;
    }

    const decisionMap = {
      accept: { action: "VALIDATION", comparisonStatus: "valide", decisionStatus: "accepte" },
      refuse: { action: "REFUS", comparisonStatus: "refuse", decisionStatus: "refuse" },
      complement: { action: "COMPLEMENT", comparisonStatus: "complement", decisionStatus: "complement" },
    } as const;
    const { action, comparisonStatus, decisionStatus } = decisionMap[decision];
    setItems((current) =>
      current.map((item) => (item.quote_id === selectedItem.quote_id ? { ...item, decision_status: decisionStatus, decision_comment: comment || null } : item))
    );
    setComparison({ ...comparison, status: comparisonStatus, recommended_quote_id: selectedItem.quote_id, updated_at: new Date().toISOString() });
    addEvent(action, selectedItem.quote_id, comment || null);
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-normal">Comparatif des devis</h1>
          <p className="text-muted-foreground text-sm">Comparaison, recommandation informative GERIMMO et decision finale du responsable.</p>
        </div>
        <Button onClick={runRecommendation}>
          <Star className="size-4" />
          Calculer la recommandation
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Devis compares</CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-2xl">{items.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recommandation</CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-base">{recommendedItem?.artisan_name ?? "A calculer"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Statut</CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-base">{comparison.status}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tableau comparatif</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artisan</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Delai</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Recu le</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.artisan_name}
                    {item.is_recommended ? <Badge className="ml-2" variant="outline">Recommande</Badge> : null}
                  </TableCell>
                  <TableCell>{euros(item.price_cents)}</TableCell>
                  <TableCell>{item.announced_delay_days ?? "-"} j</TableCell>
                  <TableCell>{item.gerimmo_rating}/5</TableCell>
                  <TableCell>{item.administrative_documents_valid ? "Valides" : "A completer"}</TableCell>
                  <TableCell>{new Date(item.received_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>{decisionLabels[item.decision_status]}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedQuoteId(item.quote_id);
                        setDrawerOpen(true);
                        addEvent("CONSULTATION", item.quote_id);
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

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selectedItem.artisan_name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid gap-5">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Prix" value={euros(selectedItem.price_cents)} />
              <Info label="Delai annonce" value={`${selectedItem.announced_delay_days ?? "-"} jours`} />
              <Info label="Note GERIMMO" value={`${selectedItem.gerimmo_rating}/5`} />
              <Info label="Documents administratifs" value={selectedItem.administrative_documents_valid ? "Valides" : "A completer"} />
              <Info label="Date de reception" value={new Date(selectedItem.received_at).toLocaleString("fr-FR")} />
              <Info label="Score" value={selectedItem.recommendation_score.toString()} />
            </div>
            <Block icon={<MessageSquare className="size-4" />} title="Commentaires">
              <p className="text-sm">{selectedItem.comments ?? "Aucun commentaire."}</p>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ajouter un commentaire de decision." />
            </Block>
            <Block icon={<FileCheck className="size-4" />} title="Rattachements futurs prepares">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Badge variant="outline">Planification: prete</Badge>
                <Badge variant="outline">Intervention: prete</Badge>
              </div>
            </Block>
            <Block icon={<History className="size-4" />} title="Historique">
              {events.map((event) => (
                <div key={event.id} className="flex justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{event.action}</span>
                  <span className="text-muted-foreground">{new Date(event.created_at).toLocaleString("fr-FR")}</span>
                </div>
              ))}
            </Block>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => decide("accept")}>
                <Check className="size-4" />
                Accepter
              </Button>
              <Button variant="outline" onClick={() => decide("refuse")}>
                <X className="size-4" />
                Refuser
              </Button>
              <Button variant="outline" onClick={() => decide("complement")}>
                <MessageSquare className="size-4" />
                Demander un complement
              </Button>
              <Button variant="outline" onClick={() => decide("cancel")}>
                <RotateCcw className="size-4" />
                Annuler la procedure
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function recommend(items: IncidentQuoteComparisonItem[]) {
  const scored = items.map((item) => ({ ...item, recommendation_score: score(item), is_recommended: false }));
  const recommended = [...scored].sort((a, b) => b.recommendation_score - a.recommendation_score || Number(b.administrative_documents_valid) - Number(a.administrative_documents_valid) || a.price_cents - b.price_cents)[0];
  return scored.map((item) => ({ ...item, is_recommended: item.quote_id === recommended.quote_id }));
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
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
