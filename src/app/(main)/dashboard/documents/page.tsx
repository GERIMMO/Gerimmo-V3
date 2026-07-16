import { requireUser } from "@/lib/auth/guards";
import { listDocuments } from "@/services/documents-service";

import { DocumentsModule } from "./_components/documents-module";

export default async function Page() {
  await requireUser();
  const payload = await listDocuments();

  return <DocumentsModule initialPayload={payload} />;
}
