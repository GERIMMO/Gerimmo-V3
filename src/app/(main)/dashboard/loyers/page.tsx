import { requireUser } from "@/lib/auth/guards";
import { listRentPeriods } from "@/services/rent-service";

import { LoyersModule } from "./_components/loyers-module";

export default async function Page() {
  await requireUser("/auth/v1/login");
  return <LoyersModule initialPeriods={await listRentPeriods()} />;
}
