"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Building2, FilePlus2, Hammer, HousePlus, Megaphone, Plus, UserPlus, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { ADMIN_ROUTES } from "@/navigation/admin/admin-navigation";

const createActions = [
  { id: "agency", title: "Créer une agence", icon: Building2 },
  { id: "owner", title: "Ajouter un propriétaire bailleur", icon: UserRoundPlus },
  { id: "user", title: "Ajouter un utilisateur", icon: UserPlus },
  { id: "property", title: "Ajouter un bien", icon: HousePlus },
  { id: "contractor", title: "Ajouter un artisan", icon: Hammer },
  { id: "document", title: "Ajouter un document", icon: FilePlus2 },
  {
    id: "announcement",
    title: "Créer une annonce globale",
    icon: Megaphone,
    href: `${ADMIN_ROUTES.articles}?create=1`,
  },
] as const;

export function AdminCreateSheet() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SidebarMenuButton
        onClick={() => setOpen(true)}
        tooltip="Créer"
        className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
      >
        <Plus />
        <span>Créer</span>
      </SidebarMenuButton>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Créer</SheetTitle>
          <SheetDescription>Démarrer une action administrative disponible.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-3 pb-4">
          {createActions.map((action) => {
            const Icon = action.icon;
            const href = "href" in action ? action.href : null;
            return (
              <Button
                key={action.id}
                type="button"
                variant="ghost"
                disabled={!href}
                onClick={() => href && navigate(href)}
                className="h-auto justify-start rounded-sm px-3 py-2.5"
              >
                <Icon data-icon="inline-start" />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="truncate">{action.title}</span>
                  {!href ? <span className="shrink-0 text-muted-foreground text-xs">Bientôt disponible</span> : null}
                </span>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
