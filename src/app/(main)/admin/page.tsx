import { SuperAdminConsole } from "@/app/(main)/dashboard/super-admin/_components/super-admin-console";
import { getAdminDashboard } from "@/services/administration-service";

export default async function AdminOverviewPage() {
  return <SuperAdminConsole initialPayload={await getAdminDashboard()} />;
}
