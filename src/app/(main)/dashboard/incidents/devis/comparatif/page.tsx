import { listQuoteComparisons } from "@/services/incident-quote-comparisons-service";

import { QuoteComparisonModule } from "./_components/quote-comparison-module";

export default async function QuoteComparisonPage() {
  return <QuoteComparisonModule initialPayload={await listQuoteComparisons()} />;
}
