import { requireUser } from "@/lib/auth/guards";
import { getReportsData } from "@/services/reports-service";

import { RapportsModule } from "./_components/rapports-module";

export default async function Page() {
  await requireUser("/auth/v1/login");
  return <RapportsModule data={await getReportsData()} />;
}
