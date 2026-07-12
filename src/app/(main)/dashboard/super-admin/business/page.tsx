import { requireSuperAdmin } from "@/services/administration-service";
import { getAdminBusinessPayload } from "@/services/business-service";

import { BusinessConsole } from "./_components/business-console";

export default async function Page() {
  await requireSuperAdmin();
  const payload = await getAdminBusinessPayload();
  return (
    <BusinessConsole
      analytics={payload.analytics}
      initialSubscriptions={payload.subscriptions}
      initialPromotions={payload.promotions}
    />
  );
}
