import type { CSSProperties, ReactNode } from "react";

import { cookies } from "next/headers";

import { AdminSidebar } from "@/app/(main)/admin/_components/admin-sidebar";
import { AdminTopbar } from "@/app/(main)/admin/_components/admin-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireSuperAdminPage } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [{ user, profile }, cookieStore] = await Promise.all([requireSuperAdminPage(), cookies()]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen} style={{ "--sidebar-width": "17rem" } as CSSProperties}>
      <AdminSidebar
        user={{
          name: profile.full_name || "Administrateur GERIMMO",
          email: user.email ?? "",
        }}
      />
      <SidebarInset className="min-w-0">
        <AdminTopbar />
        <main className="min-w-0 flex-1 p-4 md:p-5">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
