"use client";

import { useEffect, useMemo, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { ArrowLeft, ChevronRight, Eye, LogOut, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { ActiveSupervision, SupervisionSearchResult, SupervisionTargetType } from "@/types/supervision";

function allowedChildTypes(type: SupervisionTargetType): readonly SupervisionTargetType[] {
  if (type === "agency") return ["owner", "property", "tenant", "contractor", "user"];
  if (type === "owner") return ["property"];
  if (type === "property") return ["tenant"];
  return [];
}

export function SupervisionBanner({ supervision }: { readonly supervision: ActiveSupervision }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SupervisionSearchResult[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const allowedTypes = useMemo(() => allowedChildTypes(supervision.current.type), [supervision.current.type]);

  useEffect(() => {
    void fetch("/api/admin/supervision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "visit", route: pathname }),
    });
  }, [pathname]);

  useEffect(() => {
    const normalized = query.trim();
    if (!searchOpen || normalized.length < 2 || allowedTypes.length === 0) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(
        `/api/admin/supervision/search?q=${encodeURIComponent(normalized)}&organizationId=${supervision.rootOrganizationId}`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (response.ok) {
        const items = (await response.json()) as SupervisionSearchResult[];
        setResults(items.filter((item) => allowedTypes.includes(item.type)));
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [allowedTypes, query, searchOpen, supervision.rootOrganizationId]);

  async function stop() {
    const response = await fetch("/api/admin/supervision", { method: "DELETE" });
    if (!response.ok) return toast.error("Impossible de quitter la supervision.");
    router.push("/admin/supervision");
    router.refresh();
  }

  async function back() {
    const response = await fetch("/api/admin/supervision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "pop" }),
    });
    if (!response.ok) return toast.error("Retour de supervision impossible.");
    router.push("/dashboard/accueil");
    router.refresh();
  }

  async function enter(result: SupervisionSearchResult) {
    const response = await fetch("/api/admin/supervision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "push", type: result.type, targetId: result.targetId }),
    });
    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      return toast.error(error.message ?? "Contexte inaccessible.");
    }
    setSearchOpen(false);
    setQuery("");
    router.push("/dashboard/accueil");
    router.refresh();
  }

  return (
    <>
      <div className="flex min-h-12 flex-col gap-2 border-primary/20 border-b bg-primary px-4 py-2 text-primary-foreground lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Eye className="shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1 font-semibold text-xs uppercase">
              <span>Mode supervision</span>
              <span aria-hidden="true">·</span>
              <span className="font-normal normal-case">Toutes les actions sont journalisées</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
              <span>Vous pilotez actuellement :</span>
              {supervision.path.map((item, index) => (
                <span key={item.id} className="flex min-w-0 items-center gap-1">
                  {index > 0 ? <ChevronRight aria-hidden="true" /> : null}
                  <strong className="max-w-56 truncate">{item.label}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {allowedTypes.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setSearchOpen(true)}>
              <Search data-icon="inline-start" />
              Ouvrir un portail
            </Button>
          ) : null}
          {supervision.path.length > 1 ? (
            <Button variant="secondary" size="sm" onClick={back}>
              <ArrowLeft data-icon="inline-start" />
              Revenir
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={stop}>
            <LogOut data-icon="inline-start" />
            Quitter la supervision
          </Button>
        </div>
      </div>

      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Approfondir la supervision"
        description="Ouvrir une ressource autorisée dans le contexte actuel."
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Rechercher dans ce portail…" />
          <CommandList>
            <CommandEmpty>
              {query.trim().length < 2 ? "Saisissez au moins deux caractères." : "Aucun accès autorisé."}
            </CommandEmpty>
            <CommandGroup heading="Accès autorisés">
              {results.map((result) => (
                <CommandItem
                  key={`${result.type}:${result.targetId}`}
                  value={`${result.label} ${result.subtitle}`}
                  onSelect={() => enter(result)}
                >
                  <Search />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{result.label}</span>
                    <span className="block truncate text-muted-foreground text-xs">{result.subtitle}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
