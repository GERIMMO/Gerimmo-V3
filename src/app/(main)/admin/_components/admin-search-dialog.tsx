"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Search } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { adminSearchItems } from "@/navigation/admin/admin-navigation";

export function AdminSearchDialog() {
  const [open, setOpen] = useState(false);
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

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groups = [...new Set(adminSearchItems.map((item) => item.group))];

  return (
    <>
      <SidebarMenuButton type="button" onClick={() => setOpen(true)} tooltip="Rechercher">
        <Search />
        <span>Rechercher</span>
      </SidebarMenuButton>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Rechercher un module…" />
          <CommandList>
            <CommandEmpty>Aucun module trouvé.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group} heading={group}>
                {adminSearchItems
                  .filter((item) => item.group === group)
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
