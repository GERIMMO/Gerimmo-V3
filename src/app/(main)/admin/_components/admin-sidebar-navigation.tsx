"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronDown, ChevronRight } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  type AdminNavigationGroup,
  adminNavigationGroups,
  isAdminPathActive,
} from "@/navigation/admin/admin-navigation";

export function AdminSidebarNavigation() {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  function handleNavigation() {
    if (isMobile) setOpenMobile(false);
  }

  if (collapsed) {
    return (
      <SidebarGroup className="p-1">
        <SidebarMenu>
          {adminNavigationGroups.map((group) => (
            <CollapsedAdminGroup key={group.id} group={group} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-1 pb-2">
      {adminNavigationGroups.map((group) => (
        <ExpandedAdminGroup key={group.id} group={group} pathname={pathname} onNavigate={handleNavigation} />
      ))}
    </div>
  );
}

function ExpandedAdminGroup({
  group,
  pathname,
  onNavigate,
}: {
  readonly group: AdminNavigationGroup;
  readonly pathname: string;
  readonly onNavigate: () => void;
}) {
  const active = group.items.some((item) => isAdminPathActive(pathname, item.href));
  const [open, setOpen] = useState(Boolean(group.defaultOpen ?? active));

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/admin-section">
      <SidebarGroup className="p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                type="button"
                size="sm"
                isActive={active}
                className="font-semibold text-sidebar-foreground/75"
                tooltip={group.title}
              >
                <group.icon />
                <span>{group.title}</span>
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/admin-section:rotate-180" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
        <CollapsibleContent>
          <SidebarGroupContent className="pl-2">
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={isAdminPathActive(pathname, item.href)}
                    tooltip={item.title}
                    className={cn(item.emphasized && "font-medium")}
                  >
                    <Link href={item.href} prefetch={false} onClick={onNavigate}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function CollapsedAdminGroup({ group, pathname }: { readonly group: AdminNavigationGroup; readonly pathname: string }) {
  const active = group.items.some((item) => isAdminPathActive(pathname, item.href));

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton type="button" isActive={active} tooltip={group.title}>
            <group.icon />
            <span>{group.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-64 rounded-md">
          <DropdownMenuLabel className="flex items-center gap-2">
            <group.icon />
            {group.title}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {group.items.map((item) => (
              <DropdownMenuItem key={item.id} asChild>
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={isAdminPathActive(pathname, item.href) ? "page" : undefined}
                >
                  <item.icon />
                  <span className="flex-1 truncate">{item.title}</span>
                  {isAdminPathActive(pathname, item.href) ? <ChevronRight /> : null}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
