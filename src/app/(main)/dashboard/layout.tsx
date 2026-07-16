import type { ReactNode } from "react";

import { cookies } from "next/headers";
import Link from "next/link";

import { siGithub } from "simple-icons";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { NavigationProgress } from "@/components/motion/navigation-progress";
import { RouteTransition } from "@/components/motion/route-transition";
import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/guards";
import { memberTypeToPortalType } from "@/lib/auth/portal-capabilities";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getPreference } from "@/server/server-actions";
import { getActiveSupervision } from "@/services/supervision-service";

import { PortalCommunicationBanner } from "./_components/portal-communication-banner";
import { AccountSwitcher } from "./_components/sidebar/account-switcher";
import { LayoutControls } from "./_components/sidebar/layout-controls";
import { SearchDialog } from "./_components/sidebar/search-dialog";
import { ThemeSwitcher } from "./_components/sidebar/theme-switcher";
import { SupervisionBanner } from "./_components/supervision-banner";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("member_type")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  const currentUser = {
    id: user.id,
    name: profile?.full_name || user.email || "Utilisateur GERIMMO",
    email: user.email || "",
    avatar: "",
    role: profile?.is_super_admin ? "Super Admin" : "Membre GERIMMO",
  };
  const cookieStore = await cookies();
  const supervision = profile?.is_super_admin ? await getActiveSupervision() : null;
  const directPortalType = memberTypeToPortalType(membership?.member_type);
  const portalType = supervision?.current.type ?? (!profile?.is_super_admin ? directPortalType : null);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible] = await Promise.all([
    getPreference("sidebar_variant"),
    getPreference("sidebar_collapsible"),
  ]);
  const [communications, acknowledgements] = await Promise.all([
    supabase
      .from("admin_communications" as never)
      .select("id,title,message,severity,requires_acknowledgement,starts_at" as never)
      .eq("status" as never, "published" as never)
      .is("archived_at" as never, null)
      .order("starts_at" as never, { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("admin_communication_acknowledgements" as never)
      .select("communication_id" as never)
      .eq("profile_id" as never, user.id),
  ]);
  const acknowledgedIds = new Set(
    ((acknowledgements.data ?? []) as unknown as Array<{ communication_id: string }>).map(
      (item) => item.communication_id,
    ),
  );
  const portalCommunications = (
    (communications.data ?? []) as unknown as Array<{
      id: string;
      title: string;
      message: string;
      severity: string | null;
      requires_acknowledgement: boolean;
    }>
  ).filter((item) => !acknowledgedIds.has(item.id));

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <NavigationProgress />
      <AppSidebar user={currentUser} portalType={portalType} variant={variant} collapsible={collapsible} />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-w-0 overflow-x-clip",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <SearchDialog />
            </div>
            <div className="flex items-center gap-2">
              <LayoutControls />
              <ThemeSwitcher />
              <Button asChild size="icon">
                <Link
                  prefetch={false}
                  href="https://github.com/GERIMMO/Gerimmo-V3"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Ouvrir le dépôt GERIMMO V3"
                >
                  <SimpleIcon icon={siGithub} className="fill-primary-foreground" />
                </Link>
              </Button>
              <AccountSwitcher user={currentUser} />
            </div>
          </div>
        </header>
        {supervision ? <SupervisionBanner supervision={supervision} /> : null}
        <PortalCommunicationBanner initialItems={portalCommunications} />
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          <RouteTransition>{children}</RouteTransition>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
