"use client";

import { useMemo, useState } from "react";
import { Clock3, Euro, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfitabilityCalculator() {
  const [properties, setProperties] = useState(80);
  const [incidents, setIncidents] = useState(12);
  const [adminHours, setAdminHours] = useState(45);
  const result = useMemo(() => {
    const savedHours = Math.round((adminHours * 0.28 + incidents * 0.45 + properties * 0.035) * 10) / 10;
    const savedCost = Math.round(savedHours * 32);
    const monthlyPrice = properties <= 50 ? 79 : properties <= 150 ? 149 : properties <= 300 ? 249 : 399;
    return { savedHours, savedCost, roi: Math.max(0, Math.round(((savedCost - monthlyPrice) / monthlyPrice) * 100)) };
  }, [properties, incidents, adminHours]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calculateur de rentabilité</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nombre de biens">
            <Input
              type="number"
              min={1}
              value={properties}
              onChange={(event) => setProperties(Math.max(1, Number(event.target.value)))}
            />
          </Field>
          <Field label="Incidents / mois">
            <Input
              type="number"
              min={0}
              value={incidents}
              onChange={(event) => setIncidents(Math.max(0, Number(event.target.value)))}
            />
          </Field>
          <Field label="Heures administratives">
            <Input
              type="number"
              min={0}
              value={adminHours}
              onChange={(event) => setAdminHours(Math.max(0, Number(event.target.value)))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Result icon={Clock3} value={`${result.savedHours} h`} label="économisées / mois" />
          <Result icon={Euro} value={`${result.savedCost} €`} label="de coût estimé évité" />
          <Result icon={TrendingUp} value={`${result.roi} %`} label="de ROI estimé" />
        </div>
        <p className="text-muted-foreground text-xs">
          Estimation indicative fondée sur un coût horaire chargé de 32 € et des gains moyens de centralisation. Les
          résultats réels dépendent de votre organisation.
        </p>
      </CardContent>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Result({ icon: Icon, value, label }: { icon: typeof Clock3; value: string; label: string }) {
  return (
    <div className="rounded-md bg-muted p-4">
      <Icon className="size-4 text-primary" />
      <div className="mt-3 font-semibold text-2xl">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
