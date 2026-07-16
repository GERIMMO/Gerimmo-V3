"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { findAdminNavigationItem } from "@/navigation/admin/admin-navigation";

export function AdminTopbar() {
  const pathname = usePathname();
  const item = findAdminNavigationItem(pathname);

  return (
    <header className="sticky top-0 flex h-12 shrink-0 items-center border-b bg-background/95 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2 px-4">
        <SidebarTrigger aria-label="Réduire ou ouvrir le menu" />
        <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
        <span className="truncate font-medium text-sm">{item?.title ?? "Super Admin GERIMMO"}</span>
      </div>
    </header>
  );
}
