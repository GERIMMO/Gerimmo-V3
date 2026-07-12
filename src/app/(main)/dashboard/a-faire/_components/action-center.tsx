"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { Check, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ActionItem } from "@/types/administration";

export function ActionCenter({ initialActions }: { initialActions: ActionItem[] }) {
  const [actions, setActions] = useState(initialActions);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => actions.filter((item) => `${item.title} ${item.explanation}`.toLowerCase().includes(query.toLowerCase())),
    [actions, query],
  );
  async function decide(id: string, status: "accepted" | "dismissed") {
    const response = await fetch("/api/recommendations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) return toast.error("Décision impossible.");
    setActions((current) => current.filter((item) => item.id !== id));
    toast.success(status === "accepted" ? "Recommandation prise en compte." : "Recommandation écartée.");
  }
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-semibold text-2xl">À faire</h1>
        <p className="text-muted-foreground text-sm">
          Des recommandations expliquées, jamais exécutées automatiquement.
        </p>
      </header>
      <div className="relative max-w-lg">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une action"
        />
      </div>
      <div className="grid gap-3">
        {filtered.map((action) => (
          <Card key={action.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{action.title}</h2>
                  <Badge variant={action.severity === "urgent" ? "destructive" : "secondary"}>{action.severity}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">{action.explanation}</p>
              </div>
              <div className="flex gap-2">
                {action.action_url && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={action.action_url}>Examiner</Link>
                  </Button>
                )}
                <Button size="icon-sm" variant="outline" title="Écarter" onClick={() => decide(action.id, "dismissed")}>
                  <X />
                </Button>
                <Button size="icon-sm" title="Accepter" onClick={() => decide(action.id, "accepted")}>
                  <Check />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
