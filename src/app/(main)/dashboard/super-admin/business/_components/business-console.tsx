"use client";

import { useState } from "react";
import { Gift, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminSubscriptionRow, BusinessAnalytics, PromotionCode } from "@/types/business";

const money = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function BusinessConsole({
  analytics,
  initialSubscriptions,
  initialPromotions,
}: {
  analytics: BusinessAnalytics;
  initialSubscriptions: AdminSubscriptionRow[];
  initialPromotions: PromotionCode[];
}) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [promotions, setPromotions] = useState(initialPromotions);
  const [promo, setPromo] = useState({
    code: "",
    campaign: "",
    discountType: "percent" as "percent" | "fixed" | "free_month",
    discountValue: 10,
  });
  async function act(subscriptionId: string, action: "extend_trial" | "offer_month" | "suspend" | "reactivate") {
    const response = await fetch("/api/business", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscriptionId, action }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Action impossible.");
    setSubscriptions((current) => current.map((item) => (item.id === subscriptionId ? { ...item, ...data } : item)));
    toast.success("Abonnement mis à jour.");
  }
  async function createPromo() {
    const response = await fetch("/api/business/promotions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(promo),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Création impossible.");
    setPromotions((current) => [data, ...current]);
    setPromo((current) => ({ ...current, code: "", campaign: "" }));
  }
  const metrics = [
    ["Agences actives", analytics.activeAgencies],
    ["Essais", analytics.trials],
    ["Conversion", `${analytics.conversionRate}%`],
    ["Revenu mensuel", money(analytics.monthlyRevenueCents)],
    ["Revenu annuel", money(analytics.annualRevenueCents)],
    ["Churn", `${analytics.churnRate}%`],
  ];
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-semibold text-2xl">Pilotage Business</h1>
        <p className="text-muted-foreground text-sm">Abonnements, revenus et avantages commerciaux.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs">{label}</div>
              <div className="mt-1 font-semibold text-xl">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Abonnements</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {subscriptions.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
            >
              <div>
                <div className="font-medium text-sm">{item.organizations?.name ?? "Organisation"}</div>
                <div className="text-muted-foreground text-xs">{item.subscription_plans?.name ?? item.plan_key}</div>
              </div>
              <Badge variant="secondary">{item.status}</Badge>
              <div className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Prolonger l’essai"
                  onClick={() => act(item.id, "extend_trial")}
                >
                  <Gift />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Offrir un mois"
                  onClick={() => act(item.id, "offer_month")}
                >
                  <Plus />
                </Button>
                {item.status === "suspended" ? (
                  <Button size="icon-sm" variant="ghost" title="Réactiver" onClick={() => act(item.id, "reactivate")}>
                    <Play />
                  </Button>
                ) : (
                  <Button size="icon-sm" variant="ghost" title="Suspendre" onClick={() => act(item.id, "suspend")}>
                    <Pause />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Codes promotionnels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Code"
              value={promo.code}
              onChange={(event) => setPromo((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
            />
            <Input
              placeholder="Campagne"
              value={promo.campaign}
              onChange={(event) => setPromo((current) => ({ ...current, campaign: event.target.value }))}
            />
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={promo.discountType}
              onChange={(event) =>
                setPromo((current) => ({ ...current, discountType: event.target.value as typeof current.discountType }))
              }
            >
              <option value="percent">Réduction en %</option>
              <option value="fixed">Réduction fixe</option>
              <option value="free_month">Mois offert</option>
            </select>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={promo.discountValue}
                onChange={(event) => setPromo((current) => ({ ...current, discountValue: Number(event.target.value) }))}
              />
              <Button size="icon" title="Créer" disabled={!promo.code} onClick={createPromo}>
                <Plus />
              </Button>
            </div>
          </div>
          {promotions.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <div>
                <span className="font-medium text-sm">{item.code}</span>
                <span className="ml-2 text-muted-foreground text-xs">{item.campaign}</span>
              </div>
              <Badge variant={item.is_active ? "default" : "secondary"}>{item.redemption_count} utilisation(s)</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
