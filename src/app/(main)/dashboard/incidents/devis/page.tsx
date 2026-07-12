import { listIncidentQuotes } from "@/services/incident-quotes-service";

import { IncidentQuotesModule } from "./_components/incident-quotes-module";

export default async function IncidentQuotesPage() {
  return <IncidentQuotesModule initialPayload={await listIncidentQuotes()} />;
}
