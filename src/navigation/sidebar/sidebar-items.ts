import {
  Bell,
  Building2,
  ChartBar,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Database,
  File,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

import { getPortalNavigationIds, portalLabels } from "@/lib/auth/portal-capabilities";
import type { SupervisionTargetType } from "@/types/supervision";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "GERIMMO",
    items: [
      {
        id: "accueil",
        title: "Accueil",
        url: "/dashboard/accueil",
        icon: LayoutDashboard,
      },
      {
        id: "a-faire",
        title: "À faire",
        url: "/dashboard/a-faire",
        icon: ListChecks,
      },
      {
        id: "incidents",
        title: "Incidents",
        url: "/dashboard/incidents",
        icon: CircleHelp,
      },
      {
        id: "biens",
        title: "Biens",
        url: "/dashboard/biens",
        icon: Building2,
      },
      {
        id: "loyers",
        title: "Loyers",
        url: "/dashboard/loyers",
        icon: Receipt,
      },
      {
        id: "utilisateurs",
        title: "Utilisateurs",
        url: "/dashboard/utilisateurs",
        icon: Users,
      },
      {
        id: "locataires",
        title: "Locataires",
        url: "/dashboard/locataires",
        icon: Users,
      },
      {
        id: "proprietaires",
        title: "Proprietaires",
        url: "/dashboard/proprietaires",
        icon: Database,
      },
      {
        id: "artisans",
        title: "Artisans",
        url: "/dashboard/artisans",
        icon: ClipboardList,
      },
      {
        id: "documents",
        title: "Documents",
        url: "/dashboard/documents",
        icon: File,
      },
      {
        id: "echanges",
        title: "Echanges",
        url: "/dashboard/echanges",
        icon: MessageSquare,
      },
      {
        id: "notifications",
        title: "Notifications",
        url: "/dashboard/notifications",
        icon: Bell,
      },
      {
        id: "rapports",
        title: "Rapports",
        url: "/dashboard/rapports",
        icon: ChartBar,
      },
      {
        id: "parametres",
        title: "Parametres",
        url: "/dashboard/parametres",
        icon: Settings,
      },
      {
        id: "abonnement",
        title: "Abonnement",
        url: "/dashboard/abonnement",
        icon: CreditCard,
      },
      {
        id: "signaler-probleme",
        title: "Signaler un problème",
        url: "/dashboard/qualite/signaler",
        icon: CircleHelp,
      },
    ],
  },
];

export function getSidebarItemsForPortal(type: SupervisionTargetType): NavGroup[] {
  const allowed = new Set(getPortalNavigationIds(type));
  return sidebarItems.map((group) => ({
    ...group,
    label: portalLabels[type],
    items: group.items.filter((item) => allowed.has(item.id)),
  }));
}

export const getSidebarItemsForSupervision = getSidebarItemsForPortal;
