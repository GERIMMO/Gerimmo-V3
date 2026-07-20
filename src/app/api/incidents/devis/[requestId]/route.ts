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
    // `action` ne sert qu'à router : le retirer avant de transmettre le reste, sinon il part
    // vers PostgREST comme une colonne d'incident_quote_requests (qui n'existe pas) → 400.
    const { action, ...payload } = await request.json();

    if (action === "send") {
      return NextResponse.json(await sendQuoteRequest(requestId));
    }

    if (action === "archive") {
      return NextResponse.json(await archiveQuoteRequest(requestId));
    }

    if (action === "receive") {
      return NextResponse.json(await receiveQuote({ ...payload.quote, quote_request_id: requestId }));
    }

    if (action === "select") {
      return NextResponse.json(await selectQuote(payload.quote_id));
    }

    return NextResponse.json(await updateQuoteRequest({ id: requestId, ...payload }));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Modification impossible." },
      { status: 500 },
    );
  }
}
