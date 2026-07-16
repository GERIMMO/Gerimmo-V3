import {
  Activity,
  Bell,
  Bot,
  BriefcaseBusiness,
  Bug,
  Building2,
  ChartColumn,
  ChartNoAxesCombined,
  CircleAlert,
  CreditCard,
  Euro,
  FileCheck2,
  FileStack,
  Files,
  Gauge,
  Hammer,
  Headphones,
  HeartPulse,
  House,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Network,
  Newspaper,
  Plug,
  ReceiptText,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserCog,
  UserRound,
  UsersRound,
  Workflow,
  Wrench,
} from "lucide-react";

export const ADMIN_ROUTES = {
  overview: "/admin",
  tasks: "/admin/tasks",
  supervision: "/admin/supervision",
  agencies: "/admin/agencies",
  owners: "/admin/owners",
  properties: "/admin/properties",
  users: "/admin/users",
  incidents: "/admin/incidents",
  quotes: "/admin/quotes",
  interventions: "/admin/interventions",
  contractors: "/admin/contractors",
  documents: "/admin/documents",
  messages: "/admin/messages",
  notifications: "/admin/notifications",
  reports: "/admin/reports",
  subscriptions: "/admin/subscriptions",
  billing: "/admin/billing",
  revenue: "/admin/revenue",
  analytics: "/admin/analytics",
  support: "/admin/support",
  bugs: "/admin/bugs",
  ideas: "/admin/ideas",
  feedback: "/admin/feedback",
  automations: "/admin/automations",
  systemHealth: "/admin/system-health",
  auditLog: "/admin/audit-log",
  security: "/admin/security",
  integrations: "/admin/integrations",
  settings: "/admin/settings",
  documentTemplates: "/admin/document-templates",
  roles: "/admin/roles",
  administrators: "/admin/administrators",
  imports: "/admin/imports",
  articles: "/admin/articles",
  marketing: "/admin/marketing",
  telegram: "/admin/telegram",
} as const;

export type AdminRoute = (typeof ADMIN_ROUTES)[keyof typeof ADMIN_ROUTES];

export interface AdminNavigationItem {
  readonly id: string;
  readonly title: string;
  readonly href: AdminRoute;
  readonly icon: LucideIcon;
  readonly emphasized?: boolean;
}

export interface AdminNavigationGroup {
  readonly id: string;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly defaultOpen?: boolean;
  readonly items: readonly AdminNavigationItem[];
}

export const adminNavigationGroups: readonly AdminNavigationGroup[] = [
  {
    id: "pilotage",
    title: "Pilotage",
    icon: Gauge,
    defaultOpen: true,
    items: [
      { id: "overview", title: "Vue d’ensemble", href: ADMIN_ROUTES.overview, icon: LayoutDashboard, emphasized: true },
      { id: "tasks", title: "À traiter", href: ADMIN_ROUTES.tasks, icon: ListChecks, emphasized: true },
      { id: "supervision", title: "Centre de supervision", href: ADMIN_ROUTES.supervision, icon: Activity },
    ],
  },
  {
    id: "network",
    title: "Réseau GERIMMO",
    icon: Network,
    defaultOpen: true,
    items: [
      { id: "agencies", title: "Agences", href: ADMIN_ROUTES.agencies, icon: Building2, emphasized: true },
      { id: "owners", title: "Propriétaires bailleurs", href: ADMIN_ROUTES.owners, icon: UserRound },
      { id: "properties", title: "Biens gérés", href: ADMIN_ROUTES.properties, icon: House },
      { id: "users", title: "Utilisateurs", href: ADMIN_ROUTES.users, icon: UsersRound },
    ],
  },
  {
    id: "operations",
    title: "Gestion opérationnelle",
    icon: BriefcaseBusiness,
    defaultOpen: true,
    items: [
      { id: "incidents", title: "Incidents", href: ADMIN_ROUTES.incidents, icon: CircleAlert, emphasized: true },
      { id: "quotes", title: "Devis et validations", href: ADMIN_ROUTES.quotes, icon: FileCheck2 },
      { id: "interventions", title: "Interventions", href: ADMIN_ROUTES.interventions, icon: Wrench },
      { id: "contractors", title: "Artisans", href: ADMIN_ROUTES.contractors, icon: Hammer },
      { id: "documents", title: "Documents", href: ADMIN_ROUTES.documents, icon: Files },
      { id: "messages", title: "Échanges", href: ADMIN_ROUTES.messages, icon: MessagesSquare },
      { id: "notifications", title: "Notifications", href: ADMIN_ROUTES.notifications, icon: Bell },
      { id: "reports", title: "Rapports", href: ADMIN_ROUTES.reports, icon: ChartNoAxesCombined },
    ],
  },
  {
    id: "business",
    title: "Business",
    icon: CreditCard,
    items: [
      { id: "subscriptions", title: "Abonnements", href: ADMIN_ROUTES.subscriptions, icon: CreditCard },
      { id: "billing", title: "Facturation", href: ADMIN_ROUTES.billing, icon: ReceiptText },
      { id: "revenue", title: "Revenus", href: ADMIN_ROUTES.revenue, icon: Euro },
      { id: "analytics", title: "Statistiques", href: ADMIN_ROUTES.analytics, icon: ChartColumn },
    ],
  },
  {
    id: "quality",
    title: "Qualité et support",
    icon: LifeBuoy,
    defaultOpen: true,
    items: [
      { id: "support", title: "Support clients", href: ADMIN_ROUTES.support, icon: Headphones },
      { id: "bugs", title: "Bugs signalés", href: ADMIN_ROUTES.bugs, icon: Bug, emphasized: true },
      { id: "ideas", title: "Boîte à idées", href: ADMIN_ROUTES.ideas, icon: Lightbulb },
      { id: "feedback", title: "Retours utilisateurs", href: ADMIN_ROUTES.feedback, icon: MessageSquareText },
    ],
  },
  {
    id: "system",
    title: "Système",
    icon: ServerCog,
    items: [
      { id: "automations", title: "Automatisations", href: ADMIN_ROUTES.automations, icon: Workflow },
      { id: "system-health", title: "Santé de la plateforme", href: ADMIN_ROUTES.systemHealth, icon: HeartPulse },
      { id: "audit-log", title: "Journal d’activité", href: ADMIN_ROUTES.auditLog, icon: ScrollText },
      { id: "security", title: "Sécurité", href: ADMIN_ROUTES.security, icon: ShieldCheck },
      { id: "integrations", title: "Intégrations", href: ADMIN_ROUTES.integrations, icon: Plug },
    ],
  },
  {
    id: "configuration",
    title: "Configuration",
    icon: SlidersHorizontal,
    items: [
      { id: "settings", title: "Paramètres globaux", href: ADMIN_ROUTES.settings, icon: Settings2 },
      {
        id: "document-templates",
        title: "Modèles de documents",
        href: ADMIN_ROUTES.documentTemplates,
        icon: FileStack,
      },
      { id: "roles", title: "Rôles et permissions", href: ADMIN_ROUTES.roles, icon: KeyRound },
      { id: "administrators", title: "Administrateurs GERIMMO", href: ADMIN_ROUTES.administrators, icon: UserCog },
    ],
  },
];

export const adminUtilityRoutes = [
  { id: "imports", title: "Imports", href: ADMIN_ROUTES.imports, icon: Upload },
  { id: "articles", title: "Publications", href: ADMIN_ROUTES.articles, icon: Newspaper },
  { id: "marketing", title: "Centre marketing", href: ADMIN_ROUTES.marketing, icon: Megaphone },
  { id: "telegram", title: "Administration Telegram", href: ADMIN_ROUTES.telegram, icon: Bot },
] as const;

export const adminSearchItems = [
  ...adminNavigationGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title }))),
  ...adminUtilityRoutes.map((item) => ({ ...item, group: "Outils existants" })),
] as const;

export function isAdminPathActive(pathname: string, href: AdminRoute) {
  return href === ADMIN_ROUTES.overview ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function findAdminNavigationItem(pathname: string) {
  return adminSearchItems.find((item) => isAdminPathActive(pathname, item.href));
}
