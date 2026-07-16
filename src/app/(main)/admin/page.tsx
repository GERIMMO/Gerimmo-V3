import { AdminCommandCenter } from "@/app/(main)/admin/_components/admin-command-center";
import { getAdminDashboard, getPilotage } from "@/services/administration-service";

export default async function AdminOverviewPage() {
  const [dashboard, pilotage] = await Promise.all([getAdminDashboard(), getPilotage()]);
  return <AdminCommandCenter dashboard={dashboard} pilotage={pilotage} />;
}
