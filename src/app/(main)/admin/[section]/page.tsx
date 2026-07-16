import { notFound } from "next/navigation";

import { AdminModulePlaceholder } from "@/app/(main)/admin/_components/admin-module-placeholder";
import { ActionCenter } from "@/app/(main)/dashboard/a-faire/_components/action-center";
import { SuperAdminConsole } from "@/app/(main)/dashboard/super-admin/_components/super-admin-console";
import { ArticlesConsole } from "@/app/(main)/dashboard/super-admin/articles/_components/articles-console";
import BusinessPage from "@/app/(main)/dashboard/super-admin/business/page";
import ImportsPage from "@/app/(main)/dashboard/super-admin/imports/page";
import MarketingPage from "@/app/(main)/dashboard/super-admin/marketing/page";
import QualityPage from "@/app/(main)/dashboard/super-admin/qualite/page";
import TelegramPage from "@/app/(main)/dashboard/super-admin/telegram/page";
import { adminSearchItems } from "@/navigation/admin/admin-navigation";
import { getAdminDashboard, getPilotage, listArticles } from "@/services/administration-service";

interface AdminSectionPageProps {
  readonly params: Promise<{ section: string }>;
  readonly searchParams: Promise<{ create?: string }>;
}

export function generateStaticParams() {
  return adminSearchItems
    .map((item) => item.href.replace("/admin/", ""))
    .filter((section) => section && !section.includes("/"))
    .map((section) => ({ section }));
}

export default async function AdminSectionPage({ params, searchParams }: AdminSectionPageProps) {
  const { section } = await params;

  if (section === "tasks") return <ActionCenter initialActions={(await getPilotage()).actions} />;

  if (section === "agencies") {
    return (
      <SuperAdminConsole
        initialPayload={await getAdminDashboard()}
        organizationType="agency"
        title="Agences"
        description="Réseau des agences GERIMMO."
      />
    );
  }

  if (section === "owners") {
    return (
      <SuperAdminConsole
        initialPayload={await getAdminDashboard()}
        organizationType="independent_owner"
        title="Propriétaires bailleurs"
        description="Propriétaires indépendants du réseau GERIMMO."
      />
    );
  }

  if (section === "audit-log") {
    return (
      <SuperAdminConsole
        initialPayload={await getAdminDashboard()}
        title="Journal d’activité"
        description="Actions administratives historisées."
        defaultTab="journal"
      />
    );
  }

  if (["supervision", "system-health", "bugs", "feedback"].includes(section)) return <QualityPage />;
  if (["subscriptions", "billing", "revenue", "analytics"].includes(section)) return <BusinessPage />;
  if (section === "imports") return <ImportsPage />;
  if (section === "marketing") return <MarketingPage />;
  if (section === "telegram" || section === "integrations") return <TelegramPage />;

  if (section === "articles") {
    const query = await searchParams;
    return <ArticlesConsole initialArticles={await listArticles(true)} createOnMount={query.create === "1"} />;
  }

  const item = adminSearchItems.find((candidate) => candidate.href === `/admin/${section}`);
  if (!item) notFound();

  return <AdminModulePlaceholder title={item.title} />;
}
