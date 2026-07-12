import { getAdminDashboard } from "@/services/administration-service";

import { SuperAdminConsole } from "./_components/super-admin-console";

export default async function Page() {
  return <SuperAdminConsole initialPayload={await getAdminDashboard()} />;
}
