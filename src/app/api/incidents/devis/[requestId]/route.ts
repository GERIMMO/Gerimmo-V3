import { NextResponse } from "next/server";

import {
  archiveQuoteRequest,
  receiveQuote,
  selectQuote,
  sendQuoteRequest,
  updateQuoteRequest,
} from "@/services/incident-quotes-service";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { requestId } = await context.params;
    const body = await request.json();

    if (body.action === "send") {
      return NextResponse.json(await sendQuoteRequest(requestId));
    }

    if (body.action === "archive") {
      return NextResponse.json(await archiveQuoteRequest(requestId));
    }

    if (body.action === "receive") {
      return NextResponse.json(await receiveQuote({ ...body.quote, quote_request_id: requestId }));
    }

    if (body.action === "select") {
      return NextResponse.json(await selectQuote(body.quote_id));
    }

    return NextResponse.json(await updateQuoteRequest({ id: requestId, ...body }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Modification impossible." },
      { status: 500 },
    );
  }
}
