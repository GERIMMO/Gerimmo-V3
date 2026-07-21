import { requireUser } from "@/lib/auth/guards";
import { listRentPeriods, listSignableOrganizations } from "@/services/rent-service";

import { LoyersModule } from "./_components/loyers-module";

export default async function Page() {
  await requireUser("/auth/v1/login");
  const [periods, signableOrganizations] = await Promise.all([listRentPeriods(), listSignableOrganizations()]);
  return <LoyersModule initialPeriods={periods} signableOrganizations={signableOrganizations} />;
}
