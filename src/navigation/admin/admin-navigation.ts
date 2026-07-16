import {
  Activity,
  Bot,
  Bug,
  Building2,
  ChartColumn,
  CreditCard,
  Euro,
  Gauge,
  Hammer,
  Headphones,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  Plug,
  ReceiptText,
  ScrollText,
  ServerCog,
  Settings2,
  ShieldCheck,
  UserRound,
  Workflow,
} from "lucide-react";

export const ADMIN_ROUTES = {
  overview: "/admin",
  tasks: "/admin/tasks",
  supervision: "/admin/supervision",
  auditLog: "/admin/audit-log",
  agencies: "/admin/agencies",
  owners: "/admin/owners",
  contractors: "/admin/contractors",
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
  security: "/admin/security",
  integrations: "/admin/integrations",
  settings: "/admin/settings",
  properties: "/admin/properties",
  users: "/admin/users",
  incidents: "/admin/incidents",
  quotes: "/admin/quotes",
  interventions: "/admin/interventions",
  documents: "/admin/documents",
  messages: "/admin/messages",
  notifications: "/admin/notifications",
  reports: "/admin/reports",
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
    id: "command",
    title: "Centre de commandement",
    icon: Gauge,
    defaultOpen: true,
    items: [
      { id: "overview", title: "Vue d’ensemble", href: ADMIN_ROUTES.overview, icon: LayoutDashboard, emphasized: true },
      { id: "tasks", title: "À traiter", href: ADMIN_ROUTES.tasks, icon: ListChecks, emphasized: true },
      { id: "supervision", title: "Supervision temps réel", href: ADMIN_ROUTES.supervision, icon: Activity },
      { id: "audit-log", title: "Journal d’activité", href: ADMIN_ROUTES.auditLog, icon: ScrollText },
    ],
  },
  {
    id: "network",
    title: "Réseau GERIMMO",
    icon: Building2,
    defaultOpen: true,
    items: [
      { id: "agencies", title: "Agences", href: ADMIN_ROUTES.agencies, icon: Building2, emphasized: true },
      { id: "owners", title: "Propriétaires bailleurs", href: ADMIN_ROUTES.owners, icon: UserRound },
      { id: "contractors", title: "Artisans", href: ADMIN_ROUTES.contractors, icon: Hammer },
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
    id: "support",
    title: "Support",
    icon: LifeBuoy,
    items: [
      { id: "support-center", title: "Centre de support", href: ADMIN_ROUTES.support, icon: Headphones },
      { id: "bugs", title: "Bugs", href: ADMIN_ROUTES.bugs, icon: Bug, emphasized: true },
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
      { id: "system-health", title: "Santé plateforme", href: ADMIN_ROUTES.systemHealth, icon: HeartPulse },
      { id: "security", title: "Sécurité", href: ADMIN_ROUTES.security, icon: ShieldCheck },
      { id: "integrations", title: "Intégrations", href: ADMIN_ROUTES.integrations, icon: Plug },
      { id: "settings", title: "Paramètres globaux", href: ADMIN_ROUTES.settings, icon: Settings2 },
    ],
  },
];

export const adminHiddenRoutes = [
  { id: "properties", title: "Biens gérés", href: ADMIN_ROUTES.properties, icon: Building2 },
  { id: "users", title: "Utilisateurs", href: ADMIN_ROUTES.users, icon: UserRound },
  { id: "incidents", title: "Incidents", href: ADMIN_ROUTES.incidents, icon: Activity },
  { id: "quotes", title: "Devis", href: ADMIN_ROUTES.quotes, icon: ReceiptText },
  { id: "interventions", title: "Interventions", href: ADMIN_ROUTES.interventions, icon: Activity },
  { id: "documents", title: "Documents", href: ADMIN_ROUTES.documents, icon: ScrollText },
  { id: "messages", title: "Échanges", href: ADMIN_ROUTES.messages, icon: MessageSquareText },
  { id: "notifications", title: "Notifications", href: ADMIN_ROUTES.notifications, icon: Activity },
  { id: "reports", title: "Rapports", href: ADMIN_ROUTES.reports, icon: ChartColumn },
  { id: "document-templates", title: "Modèles de documents", href: ADMIN_ROUTES.documentTemplates, icon: ScrollText },
  { id: "roles", title: "Rôles", href: ADMIN_ROUTES.roles, icon: KeyRound },
  { id: "administrators", title: "Administrateurs", href: ADMIN_ROUTES.administrators, icon: ShieldCheck },
  { id: "imports", title: "Imports", href: ADMIN_ROUTES.imports, icon: Activity },
  { id: "articles", title: "Publications", href: ADMIN_ROUTES.articles, icon: MessageSquareText },
  { id: "marketing", title: "Marketing", href: ADMIN_ROUTES.marketing, icon: ChartColumn },
  { id: "telegram", title: "Telegram", href: ADMIN_ROUTES.telegram, icon: Bot },
] as const;

export const adminSearchItems = [
  ...adminNavigationGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title }))),
  ...adminHiddenRoutes.map((item) => ({ ...item, group: "Accès directs" })),
] as const;

export function isAdminPathActive(pathname: string, href: AdminRoute) {
  return href === ADMIN_ROUTES.overview ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function findAdminNavigationItem(pathname: string) {
  return adminSearchItems.find((item) => isAdminPathActive(pathname, item.href));
}
