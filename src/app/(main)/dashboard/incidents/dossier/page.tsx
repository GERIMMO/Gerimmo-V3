import { listIncidentFinalization } from "@/services/incident-finalization-service";
import { listIncidentQuotes } from "@/services/incident-quotes-service";
import { listIncidentScheduling } from "@/services/incident-scheduling-service";
import { listIncidents } from "@/services/incidents-service";

import { IncidentDossierModule } from "./_components/incident-dossier-module";

export default async function IncidentDossierPage() {
  const [incidents, quotes, scheduling, finalization] = await Promise.all([
    listIncidents(),
    listIncidentQuotes(),
    listIncidentScheduling(),
    listIncidentFinalization(),
  ]);
  return (
    <IncidentDossierModule incidents={incidents} quotes={quotes} scheduling={scheduling} finalization={finalization} />
  );
}
