"use client";

import { useState } from "react";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { OnboardingPayload, SubscriptionPlan } from "@/types/business";

export function OnboardingConsole({
  initialPayload,
  plans,
}: {
  initialPayload: OnboardingPayload;
  plans: SubscriptionPlan[];
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [organization, setOrganization] = useState({
    name: "",
    slug: "",
    planId: plans.find((plan) => plan.audience === "agency")?.id ?? "",
    organizationType: "agency" as "agency" | "independent_owner",
  });
  const compatiblePlans = plans.filter(
    (plan) => plan.audience === (organization.organizationType === "agency" ? "agency" : "owner"),
  );
  function changeOrganizationType(organizationType: "agency" | "independent_owner") {
    const audience = organizationType === "agency" ? "agency" : "owner";
    setOrganization((current) => ({
      ...current,
      organizationType,
      planId: plans.find((plan) => plan.audience === audience)?.id ?? "",
    }));
  }
  async function createOrganization() {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(organization),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message ?? "Création impossible.");
    window.location.reload();
  }
  async function complete(stepId: string) {
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stepId, status: "completed" }),
    });
    if (!response.ok) return toast.error("Mise à jour impossible.");
    setPayload((current) => {
      const steps = current.steps.map((step) =>
        step.id === stepId ? { ...step, status: "completed" as const } : step,
      );
      return {
        ...current,
        steps,
        progress: Math.round((steps.filter((step) => step.status === "completed").length / steps.length) * 100),
      };
    });
  }
  if (!payload.organizationId)
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header>
          <h1 className="font-semibold text-2xl">Créer votre espace</h1>
          <p className="text-muted-foreground text-sm">Votre essai complet de 14 jours démarre immédiatement.</p>
        </header>
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <Field label="Type de compte">
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={organization.organizationType}
                onChange={(event) => changeOrganizationType(event.target.value as "agency" | "independent_owner")}
              >
                <option value="agency">Agence immobilière</option>
                <option value="independent_owner">Propriétaire bailleur</option>
              </select>
            </Field>
            <Field label={organization.organizationType === "agency" ? "Nom de l’agence" : "Nom du patrimoine"}>
              <Input
                value={organization.name}
                onChange={(event) => setOrganization((current) => ({ ...current, name: event.target.value }))}
              />
            </Field>
            <Field label="Identifiant public">
              <Input
                value={organization.slug}
                onChange={(event) =>
                  setOrganization((current) => ({
                    ...current,
                    slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  }))
                }
              />
            </Field>
            <Field label="Offre après essai">
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={organization.planId}
                onChange={(event) => setOrganization((current) => ({ ...current, planId: event.target.value }))}
              >
                {compatiblePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              disabled={!organization.name || !organization.slug || !organization.planId}
              onClick={createOrganization}
            >
              Créer et démarrer l’essai
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header>
        <h1 className="font-semibold text-2xl">Mise en route</h1>
        <p className="text-muted-foreground text-sm">{payload.progress}% de votre configuration est terminée.</p>
      </header>
      <Progress value={payload.progress} />
      <div className="grid gap-2">
        {payload.steps.map((step) => (
          <Card key={step.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  {step.status === "completed" ? <Check className="size-4" /> : step.sort_order}
                </div>
                <div>
                  <div className="font-medium text-sm">{step.title}</div>
                  <div className="text-muted-foreground text-xs">{step.description}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {step.status !== "completed" && (
                  <Button variant="ghost" size="sm" onClick={() => complete(step.id)}>
                    Marquer terminé
                  </Button>
                )}
                {step.action_url && (
                  <Button asChild size="icon-sm" variant="outline">
                    <Link href={step.action_url}>
                      <ChevronRight />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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
