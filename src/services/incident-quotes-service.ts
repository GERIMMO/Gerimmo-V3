import { createClient } from "@/lib/supabase/server";
import type {
  CreateQuoteRequestInput,
  IncidentQuote,
  IncidentQuoteEvent,
  IncidentQuoteRecipient,
  IncidentQuoteRequest,
  IncidentQuotesPayload,
  ReceiveQuoteInput,
  UpdateQuoteRequestInput,
} from "@/types/incident-quotes";

const futureLinks = {
  validation: null,
  planification: null,
  intervention: null,
};

export async function listIncidentQuotes(): Promise<IncidentQuotesPayload> {
  const supabase = await createClient();
  const [requests, recipients, quotes, events] = await Promise.all([
    supabase.from("incident_quote_requests").select("*").order("updated_at", { ascending: false }),
    supabase.from("incident_quote_recipients").select("*").order("created_at", { ascending: true }),
    supabase.from("incident_quotes").select("*").order("received_at", { ascending: false }),
    supabase.from("incident_quote_events").select("*").order("created_at", { ascending: false }).limit(300),
  ]);

  for (const result of [requests, recipients, quotes, events]) {
    if (result.error) {
      throw result.error;
    }
  }

  return {
    requests: (requests.data ?? []) as IncidentQuoteRequest[],
    recipients: (recipients.data ?? []) as IncidentQuoteRecipient[],
    quotes: (quotes.data ?? []) as IncidentQuote[],
    events: (events.data ?? []) as IncidentQuoteEvent[],
  };
}

export async function createQuoteRequest(input: CreateQuoteRequestInput) {
  const supabase = await createClient();
  const { recipients = [], ...requestInput } = input;
  const { data, error } = await supabase
    .from("incident_quote_requests")
    .insert({
      status: "demande",
      allow_single_private_artisan: false,
      future_links: futureLinks,
      ...requestInput,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const request = data as IncidentQuoteRequest;

  if (recipients.length > 0) {
    const { error: recipientError } = await supabase.from("incident_quote_recipients").insert(
      recipients.map((recipient) => ({
        organization_id: request.organization_id,
        quote_request_id: request.id,
        status: "demande",
        ...recipient,
      })) as never,
    );

    if (recipientError) {
      throw recipientError;
    }
  }

  return request;
}

export async function updateQuoteRequest({ id, ...input }: UpdateQuoteRequestInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_quote_requests")
    .update(input as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IncidentQuoteRequest;
}

export async function sendQuoteRequest(id: string) {
  return updateQuoteRequest({ id, sent_at: new Date().toISOString(), status: "demande" });
}

export async function archiveQuoteRequest(id: string) {
  return updateQuoteRequest({ id, status: "expire", archived_at: new Date().toISOString() });
}

export async function receiveQuote(input: ReceiveQuoteInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_quotes")
    .insert({
      currency: "EUR",
      status: "recu",
      ...input,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IncidentQuote;
}

export async function selectQuote(id: string) {
  const supabase = await createClient();
  const current = await supabase
    .from("incident_quotes")
    .select("id,organization_id,quote_request_id,recipient_id")
    .eq("id", id)
    .single();

  if (current.error) {
    throw current.error;
  }

  const quote = current.data as Pick<IncidentQuote, "id" | "organization_id" | "quote_request_id" | "recipient_id">;
  await supabase
    .from("incident_quotes")
    .update({ status: "recu" } as never)
    .eq("quote_request_id", quote.quote_request_id)
    .neq("id", id);
  await supabase
    .from("incident_quote_recipients")
    .update({ status: "recu" } as never)
    .eq("quote_request_id", quote.quote_request_id)
    .neq("id", quote.recipient_id);

  const [{ data, error }, requestUpdate, recipientUpdate] = await Promise.all([
    supabase
      .from("incident_quotes")
      .update({ status: "retenu" } as never)
      .eq("id", id)
      .select("*")
      .single(),
    supabase
      .from("incident_quote_requests")
      .update({ status: "retenu" } as never)
      .eq("id", quote.quote_request_id),
    supabase
      .from("incident_quote_recipients")
      .update({ status: "retenu" } as never)
      .eq("id", quote.recipient_id),
  ]);

  for (const result of [requestUpdate, recipientUpdate]) {
    if (result.error) {
      throw result.error;
    }
  }

  if (error) {
    throw error;
  }

  return data as IncidentQuote;
}
