import { AlertTriangle, CalendarDays, CheckCircle2, FileText, Home, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-destructive" />
          <span className="size-2 rounded-full bg-chart-3" />
          <span className="size-2 rounded-full bg-chart-2" />
        </div>
        <span className="text-muted-foreground text-xs">Agence Horizon · Tableau de bord</span>
      </div>
      <div className="grid min-h-[430px] md:grid-cols-[190px_1fr]">
        <aside className="hidden border-r bg-muted/35 p-3 md:block">
          <div className="mb-5 px-2 font-semibold text-sm">GERIMMO</div>
          {[
            [Home, "Accueil"],
            [AlertTriangle, "Incidents"],
            [FileText, "Documents"],
            [Users, "Utilisateurs"],
            [CalendarDays, "Planning"],
          ].map(([Icon, label], index) => (
            <div
              key={String(label)}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${index === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="size-4" />
              {String(label)}
            </div>
          ))}
        </aside>
        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <div>
            <h3 className="font-semibold text-xl">Bonjour Claire</h3>
            <p className="text-muted-foreground text-sm">Voici les actions qui demandent votre attention.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Incidents ouverts", "7"],
              ["Devis à traiter", "3"],
              ["Rendez-vous", "5"],
              ["Documents à renouveler", "4"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border p-3">
                <div className="text-muted-foreground text-xs">{label}</div>
                <div className="mt-1 font-semibold text-xl">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-md border">
              <div className="border-b px-4 py-3 font-medium text-sm">À faire aujourd’hui</div>
              {[
                ["Valider le devis plomberie", "INC-2026-00418", "Urgent"],
                ["Relancer l’attestation assurance", "VIL-017", "À prévoir"],
                ["Confirmer le rendez-vous", "INC-2026-00411", "Aujourd’hui"],
              ].map(([title, ref, status]) => (
                <div key={ref} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0">
                  <div>
                    <div className="text-sm">{title}</div>
                    <div className="text-muted-foreground text-xs">{ref}</div>
                  </div>
                  <Badge variant="secondary">{status}</Badge>
                </div>
              ))}
            </div>
            <div className="rounded-md border p-4">
              <div className="font-medium text-sm">Activité récente</div>
              <div className="mt-4 flex flex-col gap-4">
                {[
                  "Devis reçu de Rhône Services",
                  "Créneau confirmé par le locataire",
                  "Rapport d’intervention archivé",
                ].map((item) => (
                  <div key={item} className="flex gap-2 text-xs">
                    <CheckCircle2 className="size-4 shrink-0 text-chart-2" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
