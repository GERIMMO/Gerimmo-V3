import { NextResponse } from "next/server";

import { decideQuoteComparison, recommendQuoteComparison } from "@/services/incident-quote-comparisons-service";

type RouteContext = {
  params: Promise<{ comparisonId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { comparisonId } = await context.params;
    const body = await request.json();

    if (body.action === "recommend") {
      return NextResponse.json({ recommended_quote_id: await recommendQuoteComparison(comparisonId) });
    }

    return NextResponse.json(
      await decideQuoteComparison({
        comparison_id: comparisonId,
        quote_id: body.quote_id,
        decision: body.decision,
        comment: body.comment,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Validation impossible." },
      { status: 500 },
    );
  }
}
