import { notFound } from "next/navigation";

import { FileInput } from "lucide-react";

import { AdminAuditLog } from "@/app/(main)/admin/_components/admin-audit-log";
import { AdminFunctionalModule } from "@/app/(main)/admin/_components/admin-functional-module";
import { AdminModulePlaceholder } from "@/app/(main)/admin/_components/admin-module-placeholder";
import { AdminNationalView } from "@/app/(main)/admin/_components/admin-national-view";
import { ContractorValidationConsole } from "@/app/(main)/admin/_components/contractor-validation-console";
import { IntegrationCasesConsole } from "@/app/(main)/admin/_components/integration-cases-console";
import { SupervisionCenter } from "@/app/(main)/admin/_components/supervision-center";
import { ActionCenter } from "@/app/(main)/dashboard/a-faire/_components/action-center";
import { SuperAdminConsole } from "@/app/(main)/dashboard/super-admin/_components/super-admin-console";
import { ArticlesConsole } from "@/app/(main)/dashboard/super-admin/articles/_components/articles-console";
import ImportsPage from "@/app/(main)/dashboard/super-admin/imports/page";
import TelegramPage from "@/app/(main)/dashboard/super-admin/telegram/page";
import { adminSearchItems } from "@/navigation/admin/admin-navigation";
import { getAdminAuditLog } from "@/services/admin-audit-service";
import { getAdminFunctionalPayload } from "@/services/admin-functional-service";
import { getAdminNationalView, isAdminNationalSection } from "@/services/admin-national-service";
import { getAdminDashboard, getPilotage, listArticles } from "@/services/administration-service";
import { listArtisanValidations } from "@/services/artisan-validation-service";
import { getIntegrationCases } from "@/services/integration-cases-service";
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

  if (
    [
      "subscriptions",
      "offers",
      "promotion-codes",
      "revenue",
      "payments",
      "growth",
      "usage",
      "acquisition",
      "retention",
      "user-requests",
      "bugs",
      "ideas",
      "practical-information",
      "alerts",
      "global-announcements",
      "communication-templates",
      "system-health",
      "bots",
      "automations",
      "communications",
      "integrations",
      "technical-log",
      "security",
      "ai-center",
    ].includes(section)
  ) {
    return <AdminFunctionalModule initialPayload={await getAdminFunctionalPayload(section)} />;
  }
  if (["property-imports", "user-imports", "imports"].includes(section)) return <ImportsPage />;
  if (section === "marketing") {
    return <AdminFunctionalModule initialPayload={await getAdminFunctionalPayload("acquisition")} />;
  }
  if (["bot-configuration", "telegram"].includes(section)) return <TelegramPage />;

  if (section === "articles") {
    const query = await searchParams;
    return <ArticlesConsole initialArticles={await listArticles(true)} createOnMount={query.create === "1"} />;
  }

  if (section === "integration-cases") {
    return <IntegrationCasesConsole cases={await getIntegrationCases()} />;
  }

  if (section === "contractor-validation") {
    return <ContractorValidationConsole initialArtisans={await listArtisanValidations()} />;
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

  if (isAdminNationalSection(section)) return <AdminNationalView payload={await getAdminNationalView(section)} />;

  const item = adminSearchItems.find((candidate) => candidate.href === `/admin/${section}`);
  if (!item) notFound();
  notFound();
}
