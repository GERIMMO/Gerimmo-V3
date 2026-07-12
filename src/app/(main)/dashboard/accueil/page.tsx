import { getPilotage } from "@/services/administration-service";

import { PilotageDashboard } from "../_components/pilotage-dashboard";

export default async function Page() {
  return <PilotageDashboard payload={await getPilotage()} />;
}
