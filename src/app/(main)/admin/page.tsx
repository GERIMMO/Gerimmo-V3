import { AdminCommandCenter } from "@/app/(main)/admin/_components/admin-command-center";
import { RunAutomationsCard } from "@/app/(main)/admin/_components/run-automations-card";
import { getAdminDashboard, getPilotage } from "@/services/administration-service";

export default async function AdminOverviewPage() {
  const [dashboard, pilotage] = await Promise.all([getAdminDashboard(), getPilotage()]);
  return (
    <div className="flex flex-col gap-4">
      <AdminCommandCenter dashboard={dashboard} pilotage={pilotage} />
      <RunAutomationsCard />
    </div>
  );
}
