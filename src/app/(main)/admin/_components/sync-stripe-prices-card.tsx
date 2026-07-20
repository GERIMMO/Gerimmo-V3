"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Rapport = {
  mode?: string;
  plans?: Array<{ code: string; created: string[] }>;
  message?: string;
};

/**
 * Crée dans Stripe les tarifs manquants de chaque offre (mensuel, mise en place, gestion
 * annuelle) à partir des montants enregistrés, et mémorise les identifiants.
 *
 * À relancer après avoir basculé les clés Stripe de test vers live : les tarifs créés en
 * mode test n'existent pas en mode live, ils sont alors recréés.
 */
export function SyncStripePricesCard() {
  const [pending, setPending] = useState(false);
  const [rapport, setRapport] = useState<Rapport | null>(null);

  async function synchroniser() {
    setPending(true);
    setRapport(null);
    try {
      const response = await fetch("/api/stripe/sync-prices", { method: "POST" });
      setRapport((await response.json()) as Rapport);
    } catch (error) {
      setRapport({ message: error instanceof Error ? error.message : "Appel impossible." });
    } finally {
      setPending(false);
    }
  }

  const crees = rapport?.plans?.filter((plan) => plan.created.length > 0) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarifs Stripe</CardTitle>
        <CardDescription>
          Crée dans Stripe les tarifs manquants de chaque offre — abonnement mensuel, frais de mise en place et gestion
          annuelle — à partir des montants de la grille. À relancer après le passage des clés en mode live.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" onClick={synchroniser} disabled={pending} className="w-fit">
          {pending ? "Synchronisation…" : "Synchroniser les tarifs"}
        </Button>
        {rapport?.message ? <p className="text-destructive text-sm">Échec : {rapport.message}</p> : null}
        {rapport?.mode ? (
          <div className="text-sm">
            <p className="font-medium">Mode Stripe : {rapport.mode === "live" ? "LIVE (paiements réels)" : "test"}</p>
            {crees.length === 0 ? (
              <p className="text-muted-foreground">Tous les tarifs étaient déjà en place.</p>
            ) : (
              <ul className="mt-1 text-muted-foreground">
                {crees.map((plan) => (
                  <li key={plan.code}>
                    {plan.code} : {plan.created.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
