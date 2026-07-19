import { requireUser } from "@/lib/auth/guards";
import { listExpiringDocuments } from "@/services/document-reminder-service";

import { DocumentsEcheancesModule } from "./_components/documents-echeances-module";

export default async function Page() {
  await requireUser("/auth/v1/login");
  return <DocumentsEcheancesModule initialDocuments={await listExpiringDocuments()} />;
}
