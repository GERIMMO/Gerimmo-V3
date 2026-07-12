import { getBusinessPayload, getOnboarding } from "@/services/business-service";

import { OnboardingConsole } from "./_components/onboarding-console";

export default async function Page() {
  const [payload, business] = await Promise.all([getOnboarding(), getBusinessPayload()]);
  return <OnboardingConsole initialPayload={payload} plans={business.plans} />;
}
