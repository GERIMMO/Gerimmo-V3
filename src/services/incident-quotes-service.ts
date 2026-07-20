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

import {
  getSupervisionIncidentIds,
  narrowToSupervisionScopeIncident,
  narrowToSupervisionScopeQuoteRequest,
} from "./supervision-service";

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

  const incidentIds = await getSupervisionIncidentIds();
  const scopedRequests = ((requests.data ?? []) as IncidentQuoteRequest[]).filter(
    (request) => !incidentIds || incidentIds.includes(request.incident_id),
  );
  const requestIds = new Set(scopedRequests.map((request) => request.id));

  return {
    requests: scopedRequests,
    recipients: ((recipients.data ?? []) as IncidentQuoteRecipient[]).filter(
      (recipient) => !incidentIds || requestIds.has(recipient.quote_request_id),
    ),
    quotes: ((quotes.data ?? []) as IncidentQuote[]).filter(
      (quote) => !incidentIds || requestIds.has(quote.quote_request_id),
    ),
    events: ((events.data ?? []) as IncidentQuoteEvent[]).filter(
      (event) => !incidentIds || Boolean(event.quote_request_id && requestIds.has(event.quote_request_id)),
    ),
  };
}

export async function createQuoteRequest(input: CreateQuoteRequestInput) {
  await narrowToSupervisionScopeIncident(input.incident_id);
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
  await narrowToSupervisionScopeQuoteRequest(id);
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
  await narrowToSupervisionScopeQuoteRequest(input.quote_request_id);
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
  await narrowToSupervisionScopeQuoteRequest(quote.quote_request_id);
  // Ces deux mises à jour remettent à 'recu' les devis précédemment retenus. Leur résultat
  // était intégralement jeté : même une erreur franche passait inaperçue. Si elles ne
  // s'appliquent pas, plusieurs devis restent 'retenu' sur la même demande et la suite du
  // parcours (comparatif, intervention, facturation) désigne le mauvais artisan.
  // Pas de contrôle du nombre de lignes ici : zéro ligne est légitime (aucun autre devis).
  const resetQuotes = await supabase
    .from("incident_quotes")
    .update({ status: "recu" } as never)
    .eq("quote_request_id", quote.quote_request_id)
    .neq("id", id);
  if (resetQuotes.error) throw resetQuotes.error;
  const resetRecipients = await supabase
    .from("incident_quote_recipients")
    .update({ status: "recu" } as never)
    .eq("quote_request_id", quote.quote_request_id)
    .neq("id", quote.recipient_id);
  if (resetRecipients.error) throw resetRecipients.error;

  const [{ data, error }, requestUpdate, recipientUpdate] = await Promise.all([
    supabase
      .from("incident_quotes")
      .update({ status: "retenu" } as never)
      .eq("id", id)
      .select("*")
      .single(),
    // Ces deux-là DOIVENT toucher une ligne : sans .select(), un refus RLS ne lève rien et
    // l'application affichait « devis retenu » pendant que la demande restait à son ancien
    // statut — le parcours d'intervention ne pouvait plus avancer, sans explication.
    supabase
      .from("incident_quote_requests")
      .update({ status: "retenu" } as never)
      .eq("id", quote.quote_request_id)
      .select("id"),
    supabase
      .from("incident_quote_recipients")
      .update({ status: "retenu" } as never)
      .eq("id", quote.recipient_id)
      .select("id"),
  ]);

  for (const result of [requestUpdate, recipientUpdate]) {
    if (result.error) {
      throw result.error;
    }
    if (!result.data?.length) {
      throw new Error("Selection du devis incomplete : la demande n a pas ete mise a jour.");
    }
  }

  if (error) {
    throw error;
  }

  return data as IncidentQuote;
}
