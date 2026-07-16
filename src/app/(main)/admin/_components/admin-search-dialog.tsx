"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Building2, Hammer, House, Search, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { adminSearchItems } from "@/navigation/admin/admin-navigation";
import type { SupervisionSearchResult, SupervisionTargetType } from "@/types/supervision";

function ResultIcon({ type }: { readonly type: SupervisionTargetType }) {
  if (type === "agency") return <Building2 />;
  if (type === "property") return <House />;
  if (type === "contractor") return <Hammer />;
  if (type === "user") return <UsersRound />;
  return <UserRound />;
}

export function AdminSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SupervisionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/supervision/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.ok) setResults((await response.json()) as SupervisionSearchResult[]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function supervise(result: SupervisionSearchResult) {
    const response = await fetch("/api/admin/supervision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "start",
        type: result.type,
        targetId: result.targetId,
        reason: "Supervision depuis la recherche globale",
      }),
    });
    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      toast.error(error.message ?? "Supervision impossible.");
      return;
    }
    setOpen(false);
    setQuery("");
    router.push("/dashboard/accueil");
    router.refresh();
  }

  const groups = [...new Set(adminSearchItems.map((item) => item.group))];

  return (
    <>
      <SidebarMenuButton type="button" onClick={() => setOpen(true)} tooltip="Recherche globale">
        <Search />
        <span>Recherche globale</span>
      </SidebarMenuButton>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Recherche globale GERIMMO"
        description="Rechercher un portail, une organisation ou une ressource à superviser."
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Agence, propriétaire, artisan, bien, locataire…"
          />
          <CommandList>
            <CommandEmpty>{loading ? "Recherche en cours…" : "Aucun résultat."}</CommandEmpty>
            {results.length > 0 ? (
              <CommandGroup heading="Portails et ressources">
                {results.map((result) => (
                  <CommandItem
                    key={`${result.type}:${result.targetId}:${result.organizationId}`}
                    value={`${result.label} ${result.subtitle}`}
                    onSelect={() => supervise(result)}
                  >
                    <ResultIcon type={result.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{result.label}</span>
                      <span className="block truncate text-muted-foreground text-xs">{result.subtitle}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {results.length > 0 ? <CommandSeparator /> : null}
            {groups.map((group) => (
              <CommandGroup key={group} heading={group}>
                {adminSearchItems
                  .filter(
                    (item) =>
                      item.group === group &&
                      item.title.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")),
                  )
                  .map((item) => (
                    <CommandItem key={item.id} value={`${group} ${item.title}`} onSelect={() => navigate(item.href)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
