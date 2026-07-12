import { listImportJobs } from "@/services/import-service";

import { ImportConsole } from "./_components/import-console";

export default async function Page() {
  return <ImportConsole initialJobs={await listImportJobs()} />;
}
