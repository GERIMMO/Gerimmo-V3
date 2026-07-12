"use client";

import { useState } from "react";

import { CreditCard, ExternalLink, Gift, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessPayload } from "@/types/business";

const statusLabels = {
  trial: "Essai",
  active: "Actif",
  suspended: "Suspendu",
  expired: "Expiré",
  cancelled: "Résilié",
};
const money = (cents: number | null, currency = "eur") =>
  cents === null
    ? "À configurer"
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export function SubscriptionConsole({ payload }: { payload: BusinessPayload }) {
  const [subscription, setSubscription] = useState(payload.subscription);
  async function trial(planId: string) {
    const response = await fetch("/api/business", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId, organizationId: payload.organizationId }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Essai impossible.");
    setSubscription(data);
    toast.success("Votre essai de 14 jours est actif.");
  }
  async function checkout(planId: string) {
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId, organizationId: payload.organizationId }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Paiement indisponible.");
    if (data.url) window.location.assign(data.url);
  }
  async function portal() {
    const response = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: payload.organizationId }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Portail indisponible.");
    if (data.url) window.location.assign(data.url);
  }
  function subscriptionMessage() {
    if (!subscription) return "";
    if (subscription.status === "trial" && subscription.trial_ends_at) {
      return `Essai jusqu’au ${new Date(subscription.trial_ends_at).toLocaleDateString("fr-FR")}`;
    }
    if (subscription.status === "suspended") {
      return "Vos données sont conservées. Choisissez une offre pour reprendre.";
    }
    if (subscription.current_period_end) {
      return `Prochaine échéance le ${new Date(subscription.current_period_end).toLocaleDateString("fr-FR")}`;
    }
    return "Aucune échéance programmée";
  }
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Abonnement</h1>
          <p className="text-muted-foreground text-sm">Offre, factures et renouvellement GERIMMO.</p>
        </div>
        {subscription?.stripe_customer_id && (
          <Button variant="outline" size="sm" onClick={portal}>
            <ExternalLink data-icon="inline-start" />
            Gérer le paiement
          </Button>
        )}
      </header>
      {subscription && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Abonnement actuel</span>
                <Badge>{statusLabels[subscription.status]}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">{subscriptionMessage()}</p>
            </div>
            <ShieldCheck className="text-primary" />
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {payload.plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <span className="font-semibold text-3xl">
                  {plan.requires_quote ? "Sur devis" : money(plan.amount_cents, plan.currency)}
                </span>
                {plan.amount_cents !== null && !plan.requires_quote && (
                  <span className="text-muted-foreground text-sm"> / mois</span>
                )}
              </div>
              <div className="flex flex-col gap-1 text-muted-foreground text-sm">
                <span>14 jours d’essai gratuit</span>
                <span>
                  Mise en place :{" "}
                  {plan.requires_quote && plan.code === "agency_301_600" ? "Sur devis" : money(plan.setup_fee_cents)}
                </span>
                <span>Gestion annuelle : {money(plan.annual_fee_cents)}</span>
                <span>Maintenance, assistance et évolutions incluses</span>
              </div>
              <div className="flex gap-2">
                {!subscription && (
                  <Button className="flex-1" onClick={() => trial(plan.id)}>
                    <Gift data-icon="inline-start" />
                    Démarrer l’essai
                  </Button>
                )}
                <Button
                  className="flex-1"
                  variant={subscription ? "default" : "outline"}
                  disabled={!plan.is_purchasable}
                  onClick={() => checkout(plan.id)}
                >
                  <CreditCard data-icon="inline-start" />
                  {plan.requires_quote ? "Nous contacter" : "Choisir"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {payload.invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
              <div>
                <div className="font-medium text-sm">{invoice.number}</div>
                <div className="text-muted-foreground text-xs">{money(invoice.total_cents, invoice.currency)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{invoice.status}</Badge>
                {invoice.hosted_invoice_url && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer">
                      Ouvrir
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
          {payload.invoices.length === 0 && <p className="text-muted-foreground text-sm">Aucune facture disponible.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
