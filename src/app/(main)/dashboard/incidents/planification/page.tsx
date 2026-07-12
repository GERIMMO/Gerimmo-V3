import { listIncidentScheduling } from "@/services/incident-scheduling-service";

import { IncidentSchedulingModule } from "./_components/incident-scheduling-module";

export default async function IncidentSchedulingPage() {
  return <IncidentSchedulingModule initialPayload={await listIncidentScheduling()} />;
}
