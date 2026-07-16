"use client";

import { useState } from "react";

import { AlertTriangle, Check, Info, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type PortalCommunication = {
  id: string;
  title: string;
  message: string;
  severity: string | null;
  requires_acknowledgement: boolean;
};

export function PortalCommunicationBanner({ initialItems }: { initialItems: PortalCommunication[] }) {
  const [items, setItems] = useState(initialItems);

  async function close(item: PortalCommunication) {
    if (item.requires_acknowledgement) {
      const response = await fetch("/api/communication/acknowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ communicationId: item.id }),
      });
      if (!response.ok) return toast.error("Confirmation impossible.");
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  }

  if (!items.length) return null;
  return (
    <div className="border-b bg-muted/30 px-4 py-2 lg:px-6">
      <div className="space-y-2">
        {items.slice(0, 3).map((item) => {
          const important = item.severity === "urgent" || item.severity === "critical";
          const Icon = important ? AlertTriangle : Info;
          return (
            <div key={item.id} className="flex items-start gap-3 border bg-background px-3 py-2">
              <Icon className={important ? "mt-0.5 size-4 text-destructive" : "mt-0.5 size-4 text-primary"} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.message}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title={item.requires_acknowledgement ? "Confirmer la lecture" : "Masquer"}
                onClick={() => close(item)}
              >
                {item.requires_acknowledgement ? <Check /> : <X />}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
