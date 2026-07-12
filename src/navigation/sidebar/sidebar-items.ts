import {
  Bell,
  Building2,
  ChartBar,
  CircleHelp,
  ClipboardList,
  Database,
  File,
  LayoutDashboard,
  ListChecks,
  Lock,
  type LucideIcon,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";

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
        id: "super-admin",
        title: "Super Admin",
        icon: Lock,
        subItems: [
          { id: "super-admin-overview", title: "Vue nationale", url: "/dashboard/super-admin" },
          { id: "super-admin-imports", title: "Imports", url: "/dashboard/super-admin/imports" },
          { id: "super-admin-articles", title: "Publications", url: "/dashboard/super-admin/articles" },
          { id: "super-admin-telegram", title: "Telegram", url: "/dashboard/super-admin/telegram" },
        ],
      },
    ],
  },
];
