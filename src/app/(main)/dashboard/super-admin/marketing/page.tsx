import { getMarketingCenter } from "@/services/marketing-service";

import { MarketingCenter } from "./_components/marketing-center";

export default async function Page() {
  return <MarketingCenter payload={await getMarketingCenter()} />;
}
