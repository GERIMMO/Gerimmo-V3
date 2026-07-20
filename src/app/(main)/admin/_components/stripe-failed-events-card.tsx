"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EvenementEnEchec = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  status: string;
  last_error: string | null;
  received_at: string;
};

/**
 * Événements Stripe restés en échec, avec leur cause et un bouton pour les rejouer.
 *
 * Évite l'aller-retour par le tableau de bord Stripe, et reste utilisable au-delà du délai
 * pendant lequel Stripe conserve ses propres tentatives.
 */
export function StripeFailedEventsCard() {
  const [evenements, setEvenements] = useState<EvenementEnEchec[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const response = await fetch("/api/stripe/failed-events");
    const payload = (await response.json()) as { events?: EvenementEnEchec[]; message?: string };
    if (payload.message) setMessage(payload.message);
    setEvenements(payload.events ?? []);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function rejouer(id: string) {
    setPending(id);
    setMessage(null);
    try {
      const response = await fetch("/api/stripe/failed-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const payload = (await response.json()) as { message?: string; processed?: boolean };
      setMessage(response.ok && payload.processed ? "Événement rejoué avec succès." : (payload.message ?? "Échec."));
      await charger();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rejeu impossible.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Événements Stripe en échec</CardTitle>
        <CardDescription>
          Paiements et abonnements que GERIMMO n’a pas réussi à enregistrer. Tant qu’un événement reste ici, la facture
          ou le changement d’abonnement correspondant manque dans l’application.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {message ? <p className="text-sm">{message}</p> : null}
        {evenements.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun événement en échec.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {evenements.map((evenement) => (
              <li key={evenement.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{evenement.event_type}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(evenement.received_at).toLocaleString("fr-FR")}
                  </span>
                </div>
                {evenement.last_error ? (
                  <p className="text-destructive text-xs">{evenement.last_error}</p>
                ) : (
                  <p className="text-muted-foreground text-xs">Traitement interrompu avant la fin.</p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  disabled={pending === evenement.id}
                  onClick={() => rejouer(evenement.id)}
                >
                  {pending === evenement.id ? "Rejeu…" : "Rejouer"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
