"use client";

import { useState } from "react";

import { Bug, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function QualityReportForm() {
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setPending(true);
    formData.set("screen_path", window.location.pathname);
    formData.set("browser_info", JSON.stringify({ userAgent: navigator.userAgent, language: navigator.language }));
    formData.set(
      "device_info",
      JSON.stringify({
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        touchPoints: navigator.maxTouchPoints,
      }),
    );
    const response = await fetch("/api/quality", { method: "POST", body: formData });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      toast.error(data.message ?? "Signalement impossible.");
      return;
    }
    setReference(data.reference);
    toast.success("Signalement transmis au Centre Qualité.");
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header>
        <div className="flex items-center gap-2">
          <Bug className="text-primary" />
          <h1 className="font-semibold text-2xl">Signaler un problème</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Décrivez ce qui s’est passé. Le contexte technique est joint automatiquement.
        </p>
      </header>
      {reference ? (
        <Card>
          <CardContent className="p-5">
            <div className="font-medium">Signalement {reference} enregistré</div>
            <p className="text-muted-foreground text-sm">
              L’équipe GERIMMO pourra corréler ce rapport avec les journaux techniques.
            </p>
          </CardContent>
        </Card>
      ) : (
        <form action={submit}>
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <Field label="Titre">
                <Input name="title" minLength={3} required />
              </Field>
              <Field label="Description">
                <Textarea name="description" rows={6} minLength={10} required />
              </Field>
              <Field label="Priorité">
                <select
                  name="priority"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  defaultValue="normal"
                >
                  <option value="low">Faible</option>
                  <option value="normal">Normale</option>
                  <option value="high">Élevée</option>
                  <option value="critical">Critique</option>
                </select>
              </Field>
              <Field label="API concernée, si connue">
                <Input name="api_path" placeholder="/api/..." />
              </Field>
              <Field label="Capture ou vidéo">
                <Input
                  name="files"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                  multiple
                />
                <p className="text-muted-foreground text-xs">Images ou vidéos, 50 Mo maximum par fichier.</p>
              </Field>
              <Button type="submit" disabled={pending}>
                <Upload data-icon="inline-start" />
                {pending ? "Transmission…" : "Envoyer le signalement"}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
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
