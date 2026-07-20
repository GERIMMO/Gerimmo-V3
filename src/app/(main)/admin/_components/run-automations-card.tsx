"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Déclenchement manuel des automatisations (loyers, rappels de documents, envoi des
 * e-mails en attente). La tâche planifiée les exécute une fois par jour ; ce bouton évite
 * d'attendre, et sert à vérifier qu'un envoi part réellement.
 *
 * L'autorisation est vérifiée côté serveur (super administrateur) : ce bouton ne fait que
 * déclencher l'appel.
 */
export function RunAutomationsCard() {
  const [pending, setPending] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);

  async function lancer() {
    setPending(true);
    setResultat(null);
    try {
      const response = await fetch("/api/cron/automations", { method: "POST" });
      const payload = (await response.json()) as Record<string, unknown> & { message?: string };
      if (!response.ok) {
        setResultat(`Échec : ${payload.message ?? "erreur inconnue"}`);
        return;
      }
      const emails = payload.emails as { sent?: number; failed?: number } | undefined;
      const abonnements = payload.lifecycleEmails as { sent?: number; failed?: number } | undefined;
      setResultat(
        `E-mails métier envoyés : ${emails?.sent ?? 0} (échecs ${emails?.failed ?? 0}) · ` +
          `E-mails d’abonnement : ${abonnements?.sent ?? 0} (échecs ${abonnements?.failed ?? 0})`,
      );
    } catch (error) {
      setResultat(`Échec : ${error instanceof Error ? error.message : "appel impossible"}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatisations</CardTitle>
        <CardDescription>
          Génère les loyers du mois, prépare les rappels de documents et envoie les e-mails en attente (quittances,
          relances, factures). S’exécute automatiquement une fois par jour.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" onClick={lancer} disabled={pending} className="w-fit">
          {pending ? "Envoi en cours…" : "Exécuter maintenant"}
        </Button>
        {resultat ? <p className="text-muted-foreground text-sm">{resultat}</p> : null}
      </CardContent>
    </Card>
  );
}
