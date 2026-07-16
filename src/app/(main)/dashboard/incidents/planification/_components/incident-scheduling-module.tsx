"use client";

import { useMemo, useState } from "react";

import { CalendarCheck, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { IncidentSchedulingPayload, ScheduleResponseAction } from "@/types/incident-scheduling";

export function IncidentSchedulingModule({ initialPayload }: { initialPayload: IncidentSchedulingPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedId, setSelectedId] = useState(initialPayload.requests.at(0)?.id || "");
  const selected = payload.requests.find((item) => item.id === selectedId) ?? null;
  const slots = useMemo(
    () => payload.slots.filter((item) => item.schedule_request_id === selectedId),
    [payload.slots, selectedId],
  );

  async function reload() {
    const response = await fetch("/api/incidents/planification", { cache: "no-store" });
    if (!response.ok) throw new Error("Actualisation impossible.");
    setPayload((await response.json()) as IncidentSchedulingPayload);
  }
  async function decide(action: ScheduleResponseAction, slotId?: string) {
    if (!selected) return;
    const response = await fetch(`/api/incidents/planification/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, slot_id: slotId, actor_role: "responsable" }),
    });
    if (!response.ok) throw new Error("Décision impossible.");
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="font-semibold text-2xl">Planification</h1>
        <p className="text-muted-foreground text-sm">Disponibilités proposées et créneaux confirmés.</p>
      </header>
      {payload.requests.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {payload.requests.map((request) => (
            <Card key={request.id} className="cursor-pointer" onClick={() => setSelectedId(request.id)}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Tour {request.current_round}</CardTitle>
                  <Badge variant="secondary">{request.status.replaceAll("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {payload.slots.filter((slot) => slot.schedule_request_id === request.id).length} créneau(x)
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <CalendarCheck />
            <EmptyTitle>Aucune planification</EmptyTitle>
            <EmptyDescription>Les créneaux artisans apparaîtront ici.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId("")}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Choix du créneau</SheetTitle>
                <SheetDescription>
                  Tour {selected.current_round} · {selected.status.replaceAll("_", " ")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                {slots.map((slot) => (
                  <Card key={slot.id}>
                    <CardContent className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <div className="font-medium">{new Date(slot.starts_at).toLocaleDateString("fr-FR")}</div>
                        <div className="text-muted-foreground text-sm">
                          {new Date(slot.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{" "}
                          – {new Date(slot.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => decide("acceptation_directe", slot.id)}
                        disabled={selected.status === "valide"}
                      >
                        Confirmer
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={() => decide("nouvelle_demande_artisan")}>
                  <RotateCcw data-icon="inline-start" />
                  Demander d’autres créneaux
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
