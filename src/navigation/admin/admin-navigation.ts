import {
  Activity,
  BadgePercent,
  Bell,
  Bot,
  Bug,
  Building2,
  ChartColumn,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileInput,
  FileText,
  Hammer,
  HeartPulse,
  Import,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  Megaphone,
  MessageCircleQuestion,
  MessageSquareText,
  PackageCheck,
  Plug,
  Radio,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  UserRoundCheck,
  UsersRound,
  Workflow,
} from "lucide-react";

export const ADMIN_ROUTES = {
  overview: "/admin",
  agencies: "/admin/agencies",
  owners: "/admin/owners",
  contractors: "/admin/contractors",
  integrationCases: "/admin/integration-cases",
  propertyImports: "/admin/property-imports",
  userImports: "/admin/user-imports",
  contractorValidation: "/admin/contractor-validation",
  initialDocuments: "/admin/initial-documents",
  botConfiguration: "/admin/bot-configuration",
  subscriptions: "/admin/subscriptions",
  offers: "/admin/offers",
  promotionCodes: "/admin/promotion-codes",
  revenue: "/admin/revenue",
  payments: "/admin/payments",
  growth: "/admin/growth",
  usage: "/admin/usage",
  acquisition: "/admin/acquisition",
  retention: "/admin/retention",
  userRequests: "/admin/user-requests",
  bugs: "/admin/bugs",
  ideas: "/admin/ideas",
  articles: "/admin/articles",
  practicalInformation: "/admin/practical-information",
  alerts: "/admin/alerts",
  globalAnnouncements: "/admin/global-announcements",
  communicationTemplates: "/admin/communication-templates",
  systemHealth: "/admin/system-health",
  bots: "/admin/bots",
  automations: "/admin/automations",
  communications: "/admin/communications",
  integrations: "/admin/integrations",
  technicalLog: "/admin/technical-log",
  security: "/admin/security",
  settings: "/admin/settings",
  aiCenter: "/admin/ai-center",
  auditLog: "/admin/audit-log",
  tasks: "/admin/tasks",
  supervision: "/admin/supervision",
  billing: "/admin/billing",
  analytics: "/admin/analytics",
  support: "/admin/support",
  feedback: "/admin/feedback",
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
  marketing: "/admin/marketing",
  telegram: "/admin/telegram",
} as const;

export type AdminRoute = (typeof ADMIN_ROUTES)[keyof typeof ADMIN_ROUTES];

export interface AdminNavigationItem {
  readonly id: string;
  readonly title: string;
  readonly href: AdminRoute;
  readonly icon: LucideIcon;
}

export interface AdminNavigationGroup {
  readonly id: string;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly defaultOpen?: boolean;
  readonly items: readonly AdminNavigationItem[];
}

export const adminOverviewItem: AdminNavigationItem = {
  id: "overview",
  title: "Vue d’ensemble",
  href: ADMIN_ROUTES.overview,
  icon: LayoutDashboard,
};

export const adminNavigationGroups: readonly AdminNavigationGroup[] = [
  {
    id: "network",
    title: "Réseau GERIMMO",
    icon: Building2,
    defaultOpen: true,
    items: [
      { id: "agencies", title: "Agences", href: ADMIN_ROUTES.agencies, icon: Building2 },
      { id: "owners", title: "Propriétaires bailleurs", href: ADMIN_ROUTES.owners, icon: UserRound },
      { id: "contractors", title: "Artisans", href: ADMIN_ROUTES.contractors, icon: Hammer },
    ],
  },
  {
    id: "newcomers",
    title: "Nouveaux arrivants",
    icon: UserRoundCheck,
    items: [
      {
        id: "integration-cases",
        title: "Dossiers d’intégration",
        href: ADMIN_ROUTES.integrationCases,
        icon: ClipboardCheck,
      },
      {
        id: "property-imports",
        title: "Importation des biens",
        href: ADMIN_ROUTES.propertyImports,
        icon: Import,
      },
      {
        id: "user-imports",
        title: "Importation des utilisateurs",
        href: ADMIN_ROUTES.userImports,
        icon: UsersRound,
      },
      {
        id: "contractor-validation",
        title: "Validation des artisans",
        href: ADMIN_ROUTES.contractorValidation,
        icon: FileCheck2,
      },
      {
        id: "initial-documents",
        title: "Documents initiaux",
        href: ADMIN_ROUTES.initialDocuments,
        icon: FileInput,
      },
      {
        id: "bot-configuration",
        title: "Configuration du Bot",
        href: ADMIN_ROUTES.botConfiguration,
        icon: Bot,
      },
    ],
  },
  {
    id: "business",
    title: "Business",
    icon: CreditCard,
    items: [
      { id: "subscriptions", title: "Abonnements", href: ADMIN_ROUTES.subscriptions, icon: CreditCard },
      { id: "offers", title: "Offres", href: ADMIN_ROUTES.offers, icon: PackageCheck },
      {
        id: "promotion-codes",
        title: "Codes promotionnels",
        href: ADMIN_ROUTES.promotionCodes,
        icon: BadgePercent,
      },
      { id: "revenue", title: "Revenus", href: ADMIN_ROUTES.revenue, icon: CircleDollarSign },
      { id: "payments", title: "Paiements", href: ADMIN_ROUTES.payments, icon: ReceiptText },
    ],
  },
  {
    id: "statistics",
    title: "Statistiques",
    icon: ChartColumn,
    items: [
      { id: "growth", title: "Croissance", href: ADMIN_ROUTES.growth, icon: TrendingUp },
      { id: "usage", title: "Utilisation", href: ADMIN_ROUTES.usage, icon: Activity },
      { id: "acquisition", title: "Acquisition", href: ADMIN_ROUTES.acquisition, icon: UserRoundCheck },
      { id: "retention", title: "Fidélisation", href: ADMIN_ROUTES.retention, icon: UsersRound },
    ],
  },
  {
    id: "support",
    title: "Support",
    icon: MessageCircleQuestion,
    items: [
      {
        id: "user-requests",
        title: "Demandes utilisateurs",
        href: ADMIN_ROUTES.userRequests,
        icon: MessageCircleQuestion,
      },
      { id: "bugs", title: "Bugs signalés", href: ADMIN_ROUTES.bugs, icon: Bug },
      { id: "ideas", title: "Boîte à idées", href: ADMIN_ROUTES.ideas, icon: Lightbulb },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    icon: Megaphone,
    items: [
      { id: "articles", title: "Articles", href: ADMIN_ROUTES.articles, icon: FileText },
      {
        id: "practical-information",
        title: "Informations pratiques",
        href: ADMIN_ROUTES.practicalInformation,
        icon: ScrollText,
      },
      { id: "alerts", title: "Alertes", href: ADMIN_ROUTES.alerts, icon: Bell },
      {
        id: "global-announcements",
        title: "Annonces globales",
        href: ADMIN_ROUTES.globalAnnouncements,
        icon: Megaphone,
      },
      {
        id: "communication-templates",
        title: "Modèles de communication",
        href: ADMIN_ROUTES.communicationTemplates,
        icon: MessageSquareText,
      },
    ],
  },
  {
    id: "system",
    title: "Système",
    icon: Settings2,
    items: [
      { id: "system-health", title: "Santé plateforme", href: ADMIN_ROUTES.systemHealth, icon: HeartPulse },
      { id: "bots", title: "Bots", href: ADMIN_ROUTES.bots, icon: Bot },
      { id: "automations", title: "Automatisations", href: ADMIN_ROUTES.automations, icon: Workflow },
      { id: "communications", title: "Communications", href: ADMIN_ROUTES.communications, icon: Radio },
      { id: "integrations", title: "Intégrations", href: ADMIN_ROUTES.integrations, icon: Plug },
      { id: "technical-log", title: "Journal technique", href: ADMIN_ROUTES.technicalLog, icon: ScrollText },
      { id: "security", title: "Sécurité", href: ADMIN_ROUTES.security, icon: ShieldCheck },
      { id: "ai-center", title: "Centre IA", href: ADMIN_ROUTES.aiCenter, icon: Sparkles },
      { id: "settings", title: "Paramètres", href: ADMIN_ROUTES.settings, icon: Settings2 },
    ],
  },
];

export const adminAuditItem: AdminNavigationItem = {
  id: "audit-log",
  title: "Journal d’audit",
  href: ADMIN_ROUTES.auditLog,
  icon: ScrollText,
};

export const adminLegacyRoutes: readonly AdminNavigationItem[] = [
  { id: "tasks", title: "À traiter", href: ADMIN_ROUTES.tasks, icon: ClipboardCheck },
  { id: "supervision", title: "Supervision", href: ADMIN_ROUTES.supervision, icon: Activity },
  { id: "billing", title: "Facturation", href: ADMIN_ROUTES.billing, icon: ReceiptText },
  { id: "analytics", title: "Statistiques historiques", href: ADMIN_ROUTES.analytics, icon: ChartColumn },
  { id: "support", title: "Centre de support", href: ADMIN_ROUTES.support, icon: MessageCircleQuestion },
  { id: "feedback", title: "Retours utilisateurs", href: ADMIN_ROUTES.feedback, icon: MessageSquareText },
  { id: "properties", title: "Biens gérés", href: ADMIN_ROUTES.properties, icon: Building2 },
  { id: "users", title: "Utilisateurs", href: ADMIN_ROUTES.users, icon: UsersRound },
  { id: "incidents", title: "Incidents", href: ADMIN_ROUTES.incidents, icon: Activity },
  { id: "quotes", title: "Devis", href: ADMIN_ROUTES.quotes, icon: ReceiptText },
  { id: "interventions", title: "Interventions", href: ADMIN_ROUTES.interventions, icon: Activity },
  { id: "documents", title: "Documents", href: ADMIN_ROUTES.documents, icon: FileText },
  { id: "messages", title: "Échanges", href: ADMIN_ROUTES.messages, icon: MessageSquareText },
  { id: "notifications", title: "Notifications", href: ADMIN_ROUTES.notifications, icon: Bell },
  { id: "reports", title: "Rapports", href: ADMIN_ROUTES.reports, icon: ChartColumn },
  {
    id: "document-templates",
    title: "Modèles de documents",
    href: ADMIN_ROUTES.documentTemplates,
    icon: FileText,
  },
  { id: "roles", title: "Rôles", href: ADMIN_ROUTES.roles, icon: ShieldCheck },
  { id: "administrators", title: "Administrateurs", href: ADMIN_ROUTES.administrators, icon: UserRoundCheck },
  { id: "imports", title: "Import historique", href: ADMIN_ROUTES.imports, icon: Import },
  { id: "marketing", title: "Marketing", href: ADMIN_ROUTES.marketing, icon: TrendingUp },
  { id: "telegram", title: "Telegram", href: ADMIN_ROUTES.telegram, icon: Bot },
];

export const adminVisibleItems = [
  adminOverviewItem,
  ...adminNavigationGroups.flatMap((group) => group.items),
  adminAuditItem,
] as const;

export const adminSearchItems = [
  { ...adminOverviewItem, group: "Accès principal" },
  ...adminNavigationGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title }))),
  { ...adminAuditItem, group: "Accès principal" },
  ...adminLegacyRoutes.map((item) => ({ ...item, group: "Accès historiques" })),
] as const;

export function isAdminPathActive(pathname: string, href: AdminRoute) {
  return href === ADMIN_ROUTES.overview ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function findAdminNavigationItem(pathname: string) {
  return adminSearchItems.find((item) => isAdminPathActive(pathname, item.href));
}
