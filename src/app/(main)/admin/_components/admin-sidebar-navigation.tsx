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
import {
  type AdminNavigationGroup,
  type AdminNavigationItem,
  adminAuditItem,
  adminNavigationGroups,
  adminOverviewItem,
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
          <CollapsedAdminItem item={adminOverviewItem} pathname={pathname} />
          {adminNavigationGroups.map((group) => (
            <CollapsedAdminGroup key={group.id} group={group} pathname={pathname} />
          ))}
          <CollapsedAdminItem item={adminAuditItem} pathname={pathname} />
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-1 pb-2">
      <ExpandedAdminItem item={adminOverviewItem} pathname={pathname} onNavigate={handleNavigation} />
      {adminNavigationGroups.map((group) => (
        <ExpandedAdminGroup key={group.id} group={group} pathname={pathname} onNavigate={handleNavigation} />
      ))}
      <ExpandedAdminItem item={adminAuditItem} pathname={pathname} onNavigate={handleNavigation} />
    </div>
  );
}

function ExpandedAdminItem({
  item,
  pathname,
  onNavigate,
}: {
  readonly item: AdminNavigationItem;
  readonly pathname: string;
  readonly onNavigate: () => void;
}) {
  return (
    <SidebarGroup className="p-0">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            size="sm"
            isActive={isAdminPathActive(pathname, item.href)}
            tooltip={item.title}
            className="font-semibold"
          >
            <Link href={item.href} prefetch={false} onClick={onNavigate}>
              <item.icon />
              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
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
                    className="font-medium"
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

function CollapsedAdminItem({ item, pathname }: { readonly item: AdminNavigationItem; readonly pathname: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isAdminPathActive(pathname, item.href)} tooltip={item.title}>
        <Link href={item.href} prefetch={false}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
