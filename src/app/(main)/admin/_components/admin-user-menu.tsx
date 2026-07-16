"use client";

import Link from "next/link";

import { EllipsisVertical, LogOut, Settings, UserRound } from "lucide-react";

import { logoutAction } from "@/app/(main)/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
import { ADMIN_ROUTES } from "@/navigation/admin/admin-navigation";

interface AdminUserMenuProps {
  readonly user: {
    readonly name: string;
    readonly email: string;
  };
}

export function AdminUserMenu({ user }: AdminUserMenuProps) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={`${user.name} · ${user.email}`}>
              <Avatar className="size-8 rounded-md">
                <AvatarFallback className="rounded-md">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-medium text-sm">{user.name}</span>
                <span className="truncate text-muted-foreground text-xs">{user.email}</span>
              </span>
              <EllipsisVertical className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-md"
          >
            <DropdownMenuLabel className="font-normal">
              <span className="grid min-w-0 leading-tight">
                <span className="truncate font-medium text-sm">{user.name}</span>
                <span className="truncate text-muted-foreground text-xs">{user.email}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={`${ADMIN_ROUTES.settings}#profil`}>
                  <UserRound />
                  Profil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={ADMIN_ROUTES.settings}>
                  <Settings />
                  Paramètres
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  Se déconnecter
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
