"use client";

import { useRouter } from "next/navigation";

import { Eye, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MirrorBanner({ organizationName }: { organizationName: string }) {
  const router = useRouter();
  async function stop() {
    await fetch("/api/admin/mirror", { method: "DELETE" });
    router.push("/dashboard/super-admin");
    router.refresh();
  }
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b bg-accent px-4 text-accent-foreground text-sm">
      <div className="flex items-center gap-2">
        <Eye className="size-4" />
        <span>
          Vue miroir : <strong>{organizationName}</strong>
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={stop}>
        <X data-icon="inline-start" />
        Quitter
      </Button>
    </div>
  );
}
