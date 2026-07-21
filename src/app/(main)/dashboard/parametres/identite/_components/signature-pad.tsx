"use client";

import { useEffect, useRef, useState } from "react";

import { Eraser, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Pavé de signature : on signe directement à la souris ou au doigt, sans téléverser de
 * fichier. Le tracé est exporté en PNG à fond transparent, prêt à être incrusté sur les
 * documents (le cadre du PDF fournit le fond blanc).
 *
 * Aucune bibliothèque externe : un simple canvas et les événements « pointer », qui couvrent
 * souris et écran tactile.
 */
export function SignaturePad({ onSave, saving }: { onSave: (fichier: File) => Promise<void>; saving: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vierge, setVierge] = useState(true);
  const dessine = useRef(false);
  const dernier = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Densité de pixels : un canvas net sur écran Retina. On dessine dans un repère mis à
    // l'échelle, la taille CSS reste celle du conteneur.
    const ratio = window.devicePixelRatio || 1;
    const largeur = canvas.clientWidth;
    const hauteur = canvas.clientHeight;
    canvas.width = largeur * ratio;
    canvas.height = hauteur * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#101a3c";
  }, []);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function debut(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dessine.current = true;
    dernier.current = position(event);
  }

  function trace(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessine.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const point = position(event);
    if (!ctx || !dernier.current) return;
    ctx.beginPath();
    ctx.moveTo(dernier.current.x, dernier.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    dernier.current = point;
    if (vierge) setVierge(false);
  }

  function fin() {
    dessine.current = false;
    dernier.current = null;
  }

  function effacer() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVierge(true);
  }

  async function enregistrer() {
    const canvas = canvasRef.current;
    if (!canvas || vierge) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    await onSave(new File([blob], "signature.png", { type: "image/png" }));
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-36 w-full max-w-md touch-none rounded-md border bg-white"
        style={{ touchAction: "none" }}
        onPointerDown={debut}
        onPointerMove={trace}
        onPointerUp={fin}
        onPointerLeave={fin}
        aria-label="Zone de signature"
      />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={effacer} disabled={saving}>
          <Eraser data-icon="inline-start" />
          Effacer
        </Button>
        <Button type="button" size="sm" onClick={() => enregistrer()} disabled={saving || vierge}>
          <PenLine data-icon="inline-start" />
          {saving ? "Enregistrement…" : "Enregistrer la signature"}
        </Button>
      </div>
    </div>
  );
}
