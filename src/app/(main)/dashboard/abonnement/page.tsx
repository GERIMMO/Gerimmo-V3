import { getBusinessPayload } from "@/services/business-service";

import { SubscriptionConsole } from "./_components/subscription-console";

export default async function Page() {
  return <SubscriptionConsole payload={await getBusinessPayload()} />;
}
