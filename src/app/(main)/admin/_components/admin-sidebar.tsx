"use client";

import Link from "next/link";

import { Building2 } from "lucide-react";

import { AdminCreateSheet } from "@/app/(main)/admin/_components/admin-create-sheet";
import { AdminSearchDialog } from "@/app/(main)/admin/_components/admin-search-dialog";
import { AdminSidebarNavigation } from "@/app/(main)/admin/_components/admin-sidebar-navigation";
import { AdminUserMenu } from "@/app/(main)/admin/_components/admin-user-menu";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { ADMIN_ROUTES } from "@/navigation/admin/admin-navigation";

interface AdminSidebarProps extends React.ComponentProps<typeof Sidebar> {
  readonly user: {
    readonly name: string;
    readonly email: string;
  };
}

export function AdminSidebar({ user, ...props }: AdminSidebarProps) {
  return (
    <Sidebar {...props} collapsible="icon" variant="sidebar">
      <SidebarHeader className="gap-1 border-b p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={APP_CONFIG.name}>
              <Link href={ADMIN_ROUTES.overview} prefetch={false}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                  <Building2 />
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-semibold">{APP_CONFIG.name}</span>
                  <Badge variant="secondary" className="mt-0.5 w-fit rounded-sm px-1.5 py-0 text-[10px]">
                    SUPER ADMIN
                  </Badge>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <AdminCreateSheet />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <AdminSearchDialog />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="py-1">
        <AdminSidebarNavigation />
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <AdminUserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
