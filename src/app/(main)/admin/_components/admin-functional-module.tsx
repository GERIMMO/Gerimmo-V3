"use client";

import { useMemo, useState } from "react";

import {
  Archive,
  Check,
  ChevronRight,
  CirclePause,
  Copy,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { AdminFunctionalPayload, AdminMutationAction, AdminTableRow } from "@/types/admin-functional";

const labels: Record<string, string> = {
  organisation: "Organisation",
  formule: "Formule",
  statut: "Statut",
  essai_fin: "Fin de l’essai",
  renouvellement: "Renouvellement",
  nom: "Nom",
  audience: "Audience",
  intervalle: "Période",
  prix_cents: "Prix",
  clients: "Clients",
  revenu_cents: "Revenu",
  conversion: "Conversion",
  evolution: "Nouveaux clients ce mois",
  active: "Active",
  code: "Code",
  description: "Description",
  type: "Type",
  valeur: "Valeur",
  debut: "Début",
  fin: "Fin",
  limite: "Limite",
  utilisations: "Utilisations",
  numero: "Numéro",
  montant_cents: "Montant",
  paye_le: "Paiement",
  devise: "Devise",
  erreur: "Erreur",
  indicateur: "Indicateur",
  periode_actuelle: "Période actuelle",
  periode_precedente: "Période précédente",
  semaine: "Cette semaine",
  semaine_precedente: "Semaine précédente",
  mois: "Ce mois",
  mois_precedent: "Mois précédent",
  annee: "Cette année",
  annee_precedente: "Année précédente",
  agence: "Agence",
  sujet: "Sujet",
  priorite: "Priorité",
  date: "Date",
  responsable: "Responsable",
  reference: "Référence",
  utilisateur: "Utilisateur",
  page: "Page",
  cause_probable: "Cause probable",
  risque: "Risque",
  titre: "Titre",
  auteur: "Auteur",
  votes: "Votes",
  commentaires: "Commentaires",
  popularite: "Popularité",
  difficulte: "Difficulté",
  temps: "Temps estimé",
  niveau: "Niveau",
  canaux: "Canaux",
  lecture_obligatoire: "Lecture obligatoire",
  categorie: "Catégorie",
  service: "Service",
  erreurs_24h: "Erreurs sur 24 h",
  derniere_verification: "Dernière vérification",
  bot: "Bot",
  conversations: "Conversations",
  messages_24h: "Messages sur 24 h",
  demandes_transferees: "Transferts",
  derniere_execution: "Dernière exécution",
  prochaine_execution: "Prochaine exécution",
  tentatives: "Tentatives",
  canal: "Canal",
  volume_24h: "Volume sur 24 h",
  source: "Source",
  module: "Module",
  message: "Message",
  duree_ms: "Durée",
  action: "Action",
  benefice: "Bénéfice",
  impact: "Impact",
  risk: "Risque",
  difficulty: "Difficulté",
  name: "Nom",
  category: "Catégorie",
  status: "Statut",
  last_checked_at: "Dernière vérification",
  response_time_ms: "Temps de réponse",
  last_error: "Dernière erreur",
};

const columns: Record<string, string[]> = {
  subscriptions: ["organisation", "formule", "statut", "essai_fin", "renouvellement"],
  offers: ["nom", "audience", "prix_cents", "clients", "revenu_cents", "conversion", "evolution"],
  "promotion-codes": ["code", "description", "type", "valeur", "fin", "utilisations", "statut"],
  revenue: ["organisation", "numero", "montant_cents", "paye_le"],
  payments: ["organisation", "statut", "montant_cents", "erreur", "created_at"],
  growth: ["indicateur", "semaine", "semaine_precedente", "mois", "mois_precedent", "annee", "annee_precedente"],
  usage: ["indicateur", "semaine", "semaine_precedente", "mois", "mois_precedent", "annee", "annee_precedente"],
  acquisition: ["indicateur", "semaine", "semaine_precedente", "mois", "mois_precedent", "annee", "annee_precedente"],
  retention: ["indicateur", "semaine", "semaine_precedente", "mois", "mois_precedent", "annee", "annee_precedente"],
  "user-requests": ["nom", "agence", "sujet", "priorite", "statut", "responsable", "date"],
  bugs: ["reference", "utilisateur", "page", "priorite", "statut", "date"],
  ideas: ["titre", "auteur", "votes", "commentaires", "popularite", "difficulte", "statut"],
  "practical-information": ["titre", "audience", "organisation", "statut", "debut", "fin"],
  alerts: ["titre", "niveau", "audience", "canaux", "statut", "debut", "fin"],
  "global-announcements": ["titre", "audience", "canaux", "statut", "debut"],
  "communication-templates": ["nom", "categorie", "sujet", "canaux", "statut"],
  "system-health": ["service", "statut", "erreurs_24h", "derniere_verification", "detail"],
  bots: ["bot", "statut", "conversations", "messages_24h", "erreurs_24h", "demandes_transferees"],
  automations: ["nom", "statut", "derniere_execution", "prochaine_execution", "erreurs", "tentatives"],
  communications: ["canal", "volume_24h", "erreurs_24h"],
  integrations: ["name", "category", "status", "last_checked_at", "response_time_ms", "last_error"],
  "technical-log": ["source", "niveau", "module", "message", "duree_ms", "date"],
  security: ["action", "utilisateur", "date"],
  "ai-center": ["category", "title", "impact", "difficulty", "risk", "status"],
};

const creationSections = new Set([
  "promotion-codes",
  "practical-information",
  "alerts",
  "global-announcements",
  "communication-templates",
]);

function formatMoney(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatValue(key: string, value: AdminTableRow[string]) {
  if (value === null || value === "") return "—";
  if (key.endsWith("_cents") && typeof value === "number") return formatMoney(value);
  if (key === "conversion" && typeof value === "number") return `${value} %`;
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }
  const translated: Record<string, string> = {
    active: "Actif",
    suspended: "Suspendu",
    cancelled: "Résilié",
    trial: "Essai",
    expired: "Expiré",
    published: "Publié",
    scheduled: "Programmé",
    draft: "Brouillon",
    operational: "Opérationnel",
    degraded: "Dégradé",
    down: "Indisponible",
    not_configured: "Non configuré",
    succeeded: "Réussi",
    failed: "Échoué",
    pending: "En attente",
    proposed: "Proposé",
    accepted: "Accepté",
    postponed: "Reporté",
    refused: "Refusé",
    low: "Faible",
    medium: "Moyenne",
    high: "Élevée",
    monthly: "Mensuel",
    annual: "Annuel",
    agency: "Agence",
    owner: "Propriétaire",
    browser: "Navigateur",
    storage: "Stockage",
    build: "Compilation",
    system: "Système",
    authentication: "Authentification",
    payments: "Paiements",
    email: "Emails",
    performance: "Performances",
    ux: "Expérience utilisateur",
    feature: "Fonctionnalité",
    preventive_fix: "Correction préventive",
    database: "Base de données",
    automation: "Automatisation",
    code: "Code",
    security: "Sécurité",
  };
  return translated[String(value)] ?? String(value).replaceAll("_", " ");
}

function metricValue(value: number, suffix?: string) {
  if (suffix === "cents") return formatMoney(value);
  return `${new Intl.NumberFormat("fr-FR").format(value)}${suffix ? ` ${suffix}` : ""}`;
}

function metricTone(tone: AdminFunctionalPayload["metrics"][number]["tone"]) {
  if (tone === "danger") return "text-destructive";
  if (tone === "warning") return "text-orange-600 dark:text-orange-400";
  if (tone === "success") return "text-emerald-700 dark:text-emerald-400";
  return "";
}

function communicationKind(section: string) {
  if (section === "practical-information") return "practical_info";
  if (section === "alerts") return "alert";
  return "announcement";
}

function periodCutoff(period: string) {
  if (period === "month") return Date.now() - 31 * 86400000;
  if (period === "year") return Date.now() - 366 * 86400000;
  return 0;
}

function badgeVariant(value: unknown): "default" | "secondary" | "destructive" | "outline" {
  if (["active", "published", "operational", "succeeded", "accepted", "resolved"].includes(String(value)))
    return "default";
  if (["failed", "critical", "down", "rejected", "refused"].includes(String(value))) return "destructive";
  if (["pending", "trial", "scheduled", "degraded", "postponed", "waiting"].includes(String(value))) return "secondary";
  return "outline";
}

export function AdminFunctionalModule({ initialPayload }: { initialPayload: AdminFunctionalPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [organization, setOrganization] = useState("all");
  const [plan, setPlan] = useState("all");
  const [period, setPeriod] = useState("all");
  const [selected, setSelected] = useState<AdminTableRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const displayColumns =
    columns[payload.section] ??
    Object.keys(payload.rows[0] ?? {})
      .filter((key) => key !== "id")
      .slice(0, 7);
  const statuses = useMemo(
    () => Array.from(new Set(payload.rows.map((row) => String(row.statut ?? row.status ?? "")).filter(Boolean))),
    [payload.rows],
  );
  const filteredRows = useMemo(
    () =>
      payload.rows.filter((row) => {
        const matchesQuery = Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase());
        const rowStatus = String(row.statut ?? row.status ?? "");
        const matchesOrganization = organization === "all" || row.organization_id === organization;
        const matchesPlan = plan === "all" || row.plan_id === plan;
        const dateValue = String(row.updated_at ?? row.created_at ?? row.paye_le ?? "");
        const cutoff = periodCutoff(period);
        const matchesPeriod = period === "all" || (dateValue ? new Date(dateValue).getTime() >= cutoff : false);
        return (
          matchesQuery &&
          (status === "all" || rowStatus === status) &&
          matchesOrganization &&
          matchesPlan &&
          matchesPeriod
        );
      }),
    [organization, payload.rows, period, plan, query, status],
  );

  async function refresh() {
    const response = await fetch(`/api/admin/modules/${payload.section}`);
    if (!response.ok) return toast.error("Actualisation impossible.");
    setPayload((await response.json()) as AdminFunctionalPayload);
  }

  async function mutate(action: AdminMutationAction, id?: string, values?: Record<string, unknown>) {
    setPending(true);
    const response = await fetch(`/api/admin/modules/${payload.section}`, {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, id, values }),
    });
    const result = (await response.json()) as { message?: string };
    setPending(false);
    if (!response.ok) {
      toast.error(result.message ?? "Action impossible.");
      return false;
    }
    toast.success("Modification enregistrée.");
    setSelected(null);
    setCreateOpen(false);
    await refresh();
    return true;
  }

  async function analyzeBug(id: string) {
    setPending(true);
    const response = await fetch("/api/quality", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "analyze", reportId: id }),
    });
    setPending(false);
    if (!response.ok) {
      toast.error("Analyse impossible.");
      return;
    }
    toast.success("Nouvelle analyse enregistrée.");
    setSelected(null);
    await refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-normal">{payload.title}</h1>
          <p className="text-muted-foreground text-sm">{payload.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" title="Actualiser" onClick={refresh}>
            <RefreshCw />
          </Button>
          {creationSections.has(payload.section) ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" />
              Créer
            </Button>
          ) : null}
          {payload.section === "ai-center" ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => mutate("ai_generate")}>
              <RefreshCw data-icon="inline-start" />
              Analyser la plateforme
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {payload.metrics.map((metric) => (
          <div key={metric.label} className="border bg-card px-3 py-2.5">
            <div className="text-muted-foreground text-xs">{metric.label}</div>
            <div className={`mt-1 font-semibold text-lg ${metricTone(metric.tone)}`}>
              {metricValue(metric.value, metric.suffix)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher"
            className="pl-9"
          />
        </div>
        {statuses.length ? (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {statuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {formatValue("statut", item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {payload.section === "subscriptions" ? (
          <>
            <Select value={organization} onValueChange={setOrganization}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les organisations</SelectItem>
                {payload.options?.organizations?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les formules</SelectItem>
                {payload.options?.plans?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute période</SelectItem>
                <SelectItem value="month">30 jours</SelectItem>
                <SelectItem value="year">12 mois</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : null}
      </div>

      {payload.secondaryRows?.length ? <RevenueBars rows={payload.secondaryRows} /> : null}

      <div className="min-h-0 overflow-auto border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {displayColumns.map((key) => (
                <TableHead key={key}>{labels[key] ?? key.replaceAll("_", " ")}</TableHead>
              ))}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                {displayColumns.map((key) => (
                  <TableCell key={key} className="max-w-72">
                    {["statut", "status", "priorite", "niveau"].includes(key) ? (
                      <Badge variant={badgeVariant(row[key])}>{formatValue(key, row[key])}</Badge>
                    ) : (
                      <span className="line-clamp-2">{formatValue(key, row[key])}</span>
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Consulter"
                    onClick={() => setSelected(row)}
                  >
                    <ChevronRight />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!filteredRows.length ? (
          <div className="grid min-h-48 place-items-center px-4 text-center">
            <div>
              <p className="font-medium text-sm">Aucune donnée disponible</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Aucun enregistrement Supabase ne correspond aux filtres.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Détail</SheetTitle>
            <SheetDescription>Informations enregistrées et actions disponibles.</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="space-y-5 px-4 pb-5">
              <div className="divide-y border">
                {Object.entries(selected)
                  .filter(
                    ([key]) =>
                      !["id", "organization_id", "plan_id", "assigned_profile_id", "proposal_id"].includes(key),
                  )
                  .map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{labels[key] ?? key.replaceAll("_", " ")}</span>
                      <span className="break-words">{formatValue(key, value)}</span>
                    </div>
                  ))}
              </div>
              <RowActions
                section={payload.section}
                row={selected}
                options={payload.options}
                pending={pending}
                mutate={mutate}
                analyzeBug={analyzeBug}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Créer</SheetTitle>
            <SheetDescription>Les informations seront enregistrées dans Supabase.</SheetDescription>
          </SheetHeader>
          <CreateForm section={payload.section} options={payload.options} pending={pending} mutate={mutate} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RowActions({
  section,
  row,
  options,
  pending,
  mutate,
  analyzeBug,
}: {
  section: string;
  row: AdminTableRow;
  options: AdminFunctionalPayload["options"];
  pending: boolean;
  mutate: (action: AdminMutationAction, id?: string, values?: Record<string, unknown>) => Promise<boolean>;
  analyzeBug: (id: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [planId, setPlanId] = useState(String(row.plan_id ?? ""));
  if (section === "subscriptions")
    return (
      <div className="space-y-3">
        <Label>Changer de formule</Label>
        <div className="flex gap-2">
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une offre" />
            </SelectTrigger>
            <SelectContent>
              {options?.plans?.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!planId || pending}
            onClick={() => mutate("subscription_plan", row.id, { plan_id: planId })}
          >
            <Check />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              mutate("subscription_status", row.id, { status: "suspended", reason: "Suspension Super Admin" })
            }
          >
            <CirclePause data-icon="inline-start" />
            Suspendre
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              mutate("subscription_status", row.id, { status: "active", reason: "Réactivation Super Admin" })
            }
          >
            <Play data-icon="inline-start" />
            Réactiver
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              mutate("subscription_status", row.id, { status: "cancelled", reason: "Résiliation Super Admin" })
            }
          >
            <X data-icon="inline-start" />
            Résilier
          </Button>
        </div>
      </div>
    );
  if (section === "promotion-codes") return <PromotionActions row={row} pending={pending} mutate={mutate} />;
  if (section === "user-requests")
    return (
      <div className="space-y-3">
        <Label>Responsable</Label>
        <Select
          onValueChange={(value) =>
            mutate("support_update", row.id, { assigned_profile_id: value, status: "in_progress" })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Attribuer" />
          </SelectTrigger>
          <SelectContent>
            {options?.profiles?.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note de traitement" />
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={pending}
            onClick={() =>
              mutate("support_update", row.id, { status: "resolved", resolved_at: new Date().toISOString(), note })
            }
          >
            <Check data-icon="inline-start" />
            Résoudre
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => mutate("support_update", row.id, { status: "waiting", note })}
          >
            Mettre en attente
          </Button>
        </div>
      </div>
    );
  if (section === "bugs")
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={pending} onClick={() => analyzeBug(row.id)}>
          <RefreshCw data-icon="inline-start" />
          Nouvelle analyse
        </Button>
        <Button disabled={pending} onClick={() => mutate("bug_decision", row.id, { decision: "approve" })}>
          <Check data-icon="inline-start" />
          Valider
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => mutate("bug_decision", row.id, { decision: "postpone" })}
        >
          Reporter
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() => mutate("bug_decision", row.id, { decision: "reject" })}
        >
          <X data-icon="inline-start" />
          Refuser
        </Button>
      </div>
    );
  if (section === "ideas" || section === "ai-center") {
    const action = section === "ideas" ? "idea_decision" : "ai_decision";
    return (
      <div className="space-y-3">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Motif de la décision" />
        <div className="grid grid-cols-3 gap-2">
          <Button
            disabled={pending}
            onClick={() => mutate(action, row.id, { status: section === "ideas" ? "accepted" : "accepted", note })}
          >
            Accepter
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => mutate(action, row.id, { status: "postponed", note })}
          >
            Reporter
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => mutate(action, row.id, { status: "refused", note })}
          >
            Refuser
          </Button>
        </div>
      </div>
    );
  }
  if (["practical-information", "alerts", "global-announcements"].includes(section))
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            mutate("communication_update", row.id, { status: "published", published_at: new Date().toISOString() })
          }
        >
          <Check data-icon="inline-start" />
          Publier
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            mutate("communication_update", row.id, { status: "archived", archived_at: new Date().toISOString() })
          }
        >
          <Archive data-icon="inline-start" />
          Archiver
        </Button>
      </div>
    );
  if (section === "communication-templates")
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => mutate("template_update", row.id, { is_active: row.statut !== "active" })}
      >
        {row.statut === "active" ? "Désactiver" : "Activer"}
      </Button>
    );
  if (section === "automations" && row.retryable === true)
    return (
      <Button disabled={pending} onClick={() => mutate("workflow_retry", row.id)}>
        <RefreshCw data-icon="inline-start" />
        Relancer
      </Button>
    );
  if (section === "integrations" && row.persistent === true)
    return (
      <Button disabled={pending} onClick={() => mutate("integration_check", row.id)}>
        <RefreshCw data-icon="inline-start" />
        Vérifier maintenant
      </Button>
    );
  return (
    <div className="flex items-center gap-2 border px-3 py-2 text-muted-foreground text-xs">
      <ShieldCheck className="size-4" />
      Consultation sécurisée. Aucune action destructive n’est disponible ici.
    </div>
  );
}

function RevenueBars({ rows }: { rows: AdminTableRow[] }) {
  const maximum = Math.max(...rows.map((row) => Number(row.value ?? 0)), 1);
  return (
    <div className="border bg-card p-3">
      <div className="mb-3 font-medium text-sm">Évolution des revenus</div>
      <div className="flex h-32 items-end gap-2 overflow-x-auto">
        {rows.map((item) => {
          const height = Math.max(4, Math.round((Number(item.value ?? 0) / maximum) * 100));
          return (
            <div key={item.id} className="flex min-w-12 flex-1 flex-col items-center gap-1">
              <div
                className="w-full bg-primary/80"
                style={{ height: `${height}%` }}
                title={formatMoney(Number(item.value ?? 0))}
              />
              <span className="text-[10px] text-muted-foreground">{String(item.label ?? "")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromotionActions({
  row,
  pending,
  mutate,
}: {
  row: AdminTableRow;
  pending: boolean;
  mutate: (action: AdminMutationAction, id?: string, values?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [description, setDescription] = useState(String(row.description ?? ""));
  const [value, setValue] = useState(String(row.valeur ?? ""));
  return (
    <div className="space-y-3">
      <Field label="Description">
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label="Valeur">
        <Input type="number" min={1} value={value} onChange={(event) => setValue(event.target.value)} />
      </Field>
      <Button
        className="w-full"
        variant="outline"
        disabled={pending || !value}
        onClick={() =>
          mutate("promotion_update", row.id, { campaign: description || null, discount_value: Number(value) })
        }
      >
        <Pencil data-icon="inline-start" />
        Modifier
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={pending} onClick={() => mutate("promotion_duplicate", row.id)}>
          <Copy data-icon="inline-start" />
          Dupliquer
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => mutate("promotion_update", row.id, { is_active: row.statut !== "active" })}
        >
          {row.statut === "active" ? <CirclePause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
          {row.statut === "active" ? "Suspendre" : "Réactiver"}
        </Button>
        <Button variant="destructive" disabled={pending} onClick={() => mutate("promotion_archive", row.id)}>
          <Archive data-icon="inline-start" />
          Archiver
        </Button>
      </div>
    </div>
  );
}

function CreateForm({
  section,
  options,
  pending,
  mutate,
}: {
  section: string;
  options: AdminFunctionalPayload["options"];
  pending: boolean;
  mutate: (action: AdminMutationAction, id?: string, values?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [form, setForm] = useState<Record<string, string | boolean>>({
    code: "",
    campaign: "",
    discount_type: "percent",
    discount_value: "10",
    title: "",
    message: "",
    severity: "information",
    audience_type: "all_users",
    organization_id: "",
    starts_at: "",
    ends_at: "",
    channels: "application",
    requires_acknowledgement: false,
    name: "",
    category: "information",
    subject: "",
    body: "",
  });
  const field = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  async function submit() {
    if (section === "promotion-codes") {
      await mutate("promotion_create", undefined, {
        code: String(form.code).trim().toUpperCase(),
        campaign: form.campaign || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        starts_at: new Date().toISOString(),
        expires_at: form.ends_at || null,
        is_active: true,
      });
    } else if (section === "communication-templates") {
      await mutate("template_create", undefined, {
        name: form.name,
        category: form.category,
        subject: form.subject,
        body: form.body,
        default_channels: String(form.channels)
          .split(",")
          .map((item) => item.trim()),
        is_active: true,
      });
    } else {
      const kind = communicationKind(section);
      await mutate("communication_create", undefined, {
        kind,
        title: form.title,
        message: form.message,
        severity: section === "alerts" ? form.severity : null,
        audience_type: form.audience_type,
        organization_id: form.organization_id || null,
        channels: String(form.channels)
          .split(",")
          .map((item) => item.trim()),
        status: form.starts_at && new Date(String(form.starts_at)) > new Date() ? "scheduled" : "draft",
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        requires_acknowledgement: Boolean(form.requires_acknowledgement),
      });
    }
  }
  if (section === "promotion-codes")
    return (
      <div className="space-y-4 px-4 pb-5">
        <Field label="Code">
          <Input value={String(form.code)} onChange={(event) => field("code", event.target.value.toUpperCase())} />
        </Field>
        <Field label="Description">
          <Input value={String(form.campaign)} onChange={(event) => field("campaign", event.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={String(form.discount_type)} onValueChange={(value) => field("discount_type", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Pourcentage</SelectItem>
              <SelectItem value="fixed">Montant fixe</SelectItem>
              <SelectItem value="free_month">Mois offert</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Valeur">
          <Input
            type="number"
            min={1}
            value={String(form.discount_value)}
            onChange={(event) => field("discount_value", event.target.value)}
          />
        </Field>
        <Field label="Date de fin">
          <Input
            type="datetime-local"
            value={String(form.ends_at)}
            onChange={(event) => field("ends_at", event.target.value)}
          />
        </Field>
        <Button className="w-full" disabled={pending || !form.code} onClick={submit}>
          <Plus data-icon="inline-start" />
          Créer le code
        </Button>
      </div>
    );
  if (section === "communication-templates")
    return (
      <div className="space-y-4 px-4 pb-5">
        <Field label="Nom">
          <Input value={String(form.name)} onChange={(event) => field("name", event.target.value)} />
        </Field>
        <Field label="Catégorie">
          <Input value={String(form.category)} onChange={(event) => field("category", event.target.value)} />
        </Field>
        <Field label="Sujet">
          <Input value={String(form.subject)} onChange={(event) => field("subject", event.target.value)} />
        </Field>
        <Field label="Contenu">
          <Textarea rows={8} value={String(form.body)} onChange={(event) => field("body", event.target.value)} />
        </Field>
        <Field label="Canaux">
          <Input
            value={String(form.channels)}
            onChange={(event) => field("channels", event.target.value)}
            placeholder="application, email"
          />
        </Field>
        <Button className="w-full" disabled={pending || !form.name || !form.body} onClick={submit}>
          <Plus data-icon="inline-start" />
          Créer le modèle
        </Button>
      </div>
    );
  return (
    <div className="space-y-4 px-4 pb-5">
      <Field label="Titre">
        <Input value={String(form.title)} onChange={(event) => field("title", event.target.value)} />
      </Field>
      <Field label="Message">
        <Textarea rows={7} value={String(form.message)} onChange={(event) => field("message", event.target.value)} />
      </Field>
      {section === "alerts" ? (
        <Field label="Niveau">
          <Select value={String(form.severity)} onValueChange={(value) => field("severity", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="information">Information</SelectItem>
              <SelectItem value="vigilance">Vigilance</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field label="Audience">
        <Select value={String(form.audience_type)} onValueChange={(value) => field("audience_type", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_users">Tous les utilisateurs</SelectItem>
            <SelectItem value="all_agencies">Toutes les agences</SelectItem>
            <SelectItem value="all_owners">Tous les propriétaires</SelectItem>
            <SelectItem value="all_tenants">Tous les locataires</SelectItem>
            <SelectItem value="all_contractors">Tous les artisans</SelectItem>
            <SelectItem value="organization">Agence spécifique</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {form.audience_type === "organization" ? (
        <Field label="Agence">
          <Select value={String(form.organization_id)} onValueChange={(value) => field("organization_id", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              {options?.organizations?.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field label="Canaux">
        <Input
          value={String(form.channels)}
          onChange={(event) => field("channels", event.target.value)}
          placeholder="application, email, telegram"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Début">
          <Input
            type="datetime-local"
            value={String(form.starts_at)}
            onChange={(event) => field("starts_at", event.target.value)}
          />
        </Field>
        <Field label="Fin">
          <Input
            type="datetime-local"
            value={String(form.ends_at)}
            onChange={(event) => field("ends_at", event.target.value)}
          />
        </Field>
      </div>
      {section === "alerts" ? (
        <div className="flex items-center justify-between border px-3 py-2">
          <Label>Lecture obligatoire</Label>
          <Switch
            checked={Boolean(form.requires_acknowledgement)}
            onCheckedChange={(value) => field("requires_acknowledgement", value)}
          />
        </div>
      ) : null}
      <Button className="w-full" disabled={pending || !form.title || !form.message} onClick={submit}>
        <Plus data-icon="inline-start" />
        Enregistrer
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
