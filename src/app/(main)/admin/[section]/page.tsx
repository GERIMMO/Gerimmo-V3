import { notFound } from "next/navigation";

import { ClipboardCheck, FileCheck2, FileInput, MessageSquareText } from "lucide-react";

import { AdminAuditLog } from "@/app/(main)/admin/_components/admin-audit-log";
import { AdminModulePlaceholder } from "@/app/(main)/admin/_components/admin-module-placeholder";
import { AdminNationalView } from "@/app/(main)/admin/_components/admin-national-view";
import { SupervisionCenter } from "@/app/(main)/admin/_components/supervision-center";
import { ActionCenter } from "@/app/(main)/dashboard/a-faire/_components/action-center";
import { SuperAdminConsole } from "@/app/(main)/dashboard/super-admin/_components/super-admin-console";
import { ArticlesConsole } from "@/app/(main)/dashboard/super-admin/articles/_components/articles-console";
import BusinessPage from "@/app/(main)/dashboard/super-admin/business/page";
import ImportsPage from "@/app/(main)/dashboard/super-admin/imports/page";
import MarketingPage from "@/app/(main)/dashboard/super-admin/marketing/page";
import QualityPage from "@/app/(main)/dashboard/super-admin/qualite/page";
import TelegramPage from "@/app/(main)/dashboard/super-admin/telegram/page";
import { adminSearchItems } from "@/navigation/admin/admin-navigation";
import { getAdminAuditLog } from "@/services/admin-audit-service";
import { getAdminNationalView, isAdminNationalSection } from "@/services/admin-national-service";
import { getAdminDashboard, getPilotage, listArticles } from "@/services/administration-service";
import { getSupervisionCenter } from "@/services/supervision-service";

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
  if (section === "supervision") return <SupervisionCenter payload={await getSupervisionCenter()} />;

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

  if (section === "audit-log") return <AdminAuditLog payload={await getAdminAuditLog()} />;

  if (["system-health", "alerts", "technical-log", "bugs", "feedback"].includes(section)) return <QualityPage />;
  if (["subscriptions", "offers", "promotion-codes", "revenue", "payments", "billing", "analytics"].includes(section)) {
    return <BusinessPage />;
  }
  if (["property-imports", "user-imports", "imports"].includes(section)) return <ImportsPage />;
  if (["growth", "usage", "acquisition", "retention", "marketing"].includes(section)) return <MarketingPage />;
  if (["bot-configuration", "bots", "telegram", "integrations"].includes(section)) return <TelegramPage />;

  if (section === "articles" || section === "global-announcements") {
    const query = await searchParams;
    return <ArticlesConsole initialArticles={await listArticles(true)} createOnMount={query.create === "1"} />;
  }

  if (section === "user-requests") {
    return <AdminNationalView payload={await getAdminNationalView("support")} />;
  }

  if (section === "communications") {
    return <AdminNationalView payload={await getAdminNationalView("messages")} />;
  }

  if (section === "integration-cases") {
    return (
      <AdminModulePlaceholder
        title="Dossiers d’intégration"
        description="Suivi centralisé de l’arrivée des organisations et de leur mise en service."
        icon={ClipboardCheck}
      />
    );
  }

  if (section === "contractor-validation") {
    return (
      <AdminModulePlaceholder
        title="Validation des artisans"
        description="Contrôle des justificatifs légaux et administratifs avant activation."
        icon={FileCheck2}
      />
    );
  }

  if (section === "initial-documents") {
    return (
      <AdminModulePlaceholder
        title="Documents initiaux"
        description="Contrôle des pièces nécessaires à l’ouverture d’un portail GERIMMO."
        icon={FileInput}
      />
    );
  }

  if (["practical-information", "communication-templates"].includes(section)) {
    const item = adminSearchItems.find((candidate) => candidate.href === `/admin/${section}`);
    if (!item) notFound();
    return (
      <AdminModulePlaceholder
        title={item.title}
        description="Espace national de préparation et de gouvernance des communications GERIMMO."
        icon={MessageSquareText}
      />
    );
  }

  if (isAdminNationalSection(section)) return <AdminNationalView payload={await getAdminNationalView(section)} />;

  const item = adminSearchItems.find((candidate) => candidate.href === `/admin/${section}`);
  if (!item) notFound();
  notFound();
}
