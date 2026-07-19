import { AlertTriangle, Building2, Receipt, Wrench } from "lucide-react";

import type { ReportsData } from "@/services/reports-service";

function euros(cents: number) {
  return `${Math.round(cents / 100).toLocaleString("fr-FR")} €`;
}

function humanize(key: string) {
  const label = key.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function frMonth(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-2 font-semibold text-2xl">{value}</div>
      {hint ? <div className="mt-0.5 text-muted-foreground text-xs">{hint}</div> : null}
    </div>
  );
}

function Bars({ title, data }: { title: string; data: Array<{ key: string; count: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-3 text-muted-foreground text-sm">Aucune donnée.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.map((item) => (
            <li key={item.key} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-muted-foreground text-sm" title={humanize(item.key)}>
                {humanize(item.key)}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-medium text-sm tabular-nums">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RapportsModule({ data }: { data: ReportsData }) {
  const incidentsOuverts =
    data.incidents.byStatus
      .filter((item) => item.key === "nouveau" || item.key === "en_cours")
      .reduce((sum, item) => sum + item.count, 0) || 0;
  const interventionsEnCours =
    data.interventions.byStatus
      .filter((item) => ["planifiee", "confirmee", "en_cours"].includes(item.key))
      .reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <div className="flex h-full flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="font-heading font-semibold text-xl tracking-normal">Rapports</h1>
        <p className="text-muted-foreground text-sm">
          Vue d’ensemble de votre activité : incidents, loyers, patrimoine et interventions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={AlertTriangle}
          label="Incidents ouverts"
          value={String(incidentsOuverts)}
          hint={`${data.incidents.last30Days} sur 30 j`}
        />
        <Kpi
          icon={Receipt}
          label="Recouvrement du mois"
          value={`${data.rent.recoveryRate} %`}
          hint={`${euros(data.rent.collectedCents)} / ${euros(data.rent.expectedCents)}`}
        />
        <Kpi
          icon={Building2}
          label="Taux d’occupation"
          value={`${data.patrimoine.occupancyRate} %`}
          hint={`${data.patrimoine.occupes}/${data.patrimoine.totalBiens} biens`}
        />
        <Kpi
          icon={Wrench}
          label="Interventions en cours"
          value={String(interventionsEnCours)}
          hint={`${data.interventions.total} au total`}
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-medium text-sm">Incidents</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Bars title="Par statut" data={data.incidents.byStatus} />
          <Bars title="Par priorité" data={data.incidents.byPriority} />
          <Bars title="Catégories principales" data={data.incidents.topCategories} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-sm">Loyers — {frMonth(data.rent.month)}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Receipt} label="Attendus" value={String(data.rent.counts.attendu)} />
          <Kpi icon={Receipt} label="Reçus" value={String(data.rent.counts.recu)} />
          <Kpi
            icon={Receipt}
            label="Impayés"
            value={String(data.rent.counts.impaye + data.rent.counts.mise_en_demeure)}
          />
          <Kpi
            icon={Receipt}
            label="Encaissé"
            value={euros(data.rent.collectedCents)}
            hint={`sur ${euros(data.rent.expectedCents)} attendus`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-sm">Patrimoine &amp; interventions</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi icon={Building2} label="Biens" value={String(data.patrimoine.totalBiens)} />
            <Kpi icon={Building2} label="Occupés" value={String(data.patrimoine.occupes)} />
            <Kpi icon={Building2} label="Vacants" value={String(data.patrimoine.vacants)} />
          </div>
          <Bars title="Interventions par statut" data={data.interventions.byStatus} />
        </div>
      </section>

      {data.truncated ? (
        <p className="text-muted-foreground text-xs">
          Certaines statistiques sont calculées sur un échantillon récent (volume important).
        </p>
      ) : null}
    </div>
  );
}
