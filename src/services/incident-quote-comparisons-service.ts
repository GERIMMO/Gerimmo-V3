import { createClient } from "@/lib/supabase/server";
import type {
  CreateComparisonInput,
  DecideComparisonInput,
  IncidentQuoteComparison,
  IncidentQuoteComparisonItem,
  IncidentQuoteComparisonsPayload,
  IncidentQuoteValidationEvent,
} from "@/types/incident-quote-comparisons";

import { getSupervisionQuoteRequestIds, narrowToSupervisionScopeQuoteRequest } from "./supervision-service";

const futureLinks = {
  planification: null,
  intervention: null,
};

export function calculateRecommendationScore(
  priceCents: number,
  gerimmoRating: number,
  administrativeDocumentsValid: boolean,
) {
  return Number(
    (
      (1000000 / Math.max(priceCents, 1)) * 0.45 +
      gerimmoRating * 20 * 0.35 +
      (administrativeDocumentsValid ? 20 : 0)
    ).toFixed(4),
  );
}

export async function listQuoteComparisons(): Promise<IncidentQuoteComparisonsPayload> {
  const supabase = await createClient();
  const [comparisons, items, events] = await Promise.all([
    supabase.from("incident_quote_comparisons").select("*").order("updated_at", { ascending: false }),
    supabase.from("incident_quote_comparison_items").select("*").order("recommendation_score", { ascending: false }),
    supabase
      .from("incident_quote_validation_events")
      .select("id,organization_id,comparison_id,quote_id,actor_profile_id,action,comment,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  for (const result of [comparisons, items, events]) {
    if (result.error) {
      throw result.error;
    }
  }

  const requestIds = await getSupervisionQuoteRequestIds();
  const scopedComparisons = ((comparisons.data ?? []) as IncidentQuoteComparison[]).filter(
    (comparison) => !requestIds || requestIds.includes(comparison.quote_request_id),
  );
  const comparisonIds = new Set(scopedComparisons.map((comparison) => comparison.id));

  return {
    comparisons: scopedComparisons,
    items: ((items.data ?? []) as IncidentQuoteComparisonItem[]).filter(
      (item) => !requestIds || comparisonIds.has(item.comparison_id),
    ),
    events: ((events.data ?? []) as IncidentQuoteValidationEvent[]).filter(
      (event) => !requestIds || Boolean(event.comparison_id && comparisonIds.has(event.comparison_id)),
    ),
  };
}

export async function createQuoteComparison(input: CreateComparisonInput) {
  await narrowToSupervisionScopeQuoteRequest(input.quote_request_id);
  const supabase = await createClient();
  const { items, ...comparisonInput } = input;
  const { data, error } = await supabase
    .from("incident_quote_comparisons")
    .insert({ future_links: futureLinks, ...comparisonInput } as never)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const comparison = data as IncidentQuoteComparison;
  const enrichedItems = items.map((item) => ({
    organization_id: comparison.organization_id,
    comparison_id: comparison.id,
    recommendation_score: calculateRecommendationScore(
      item.price_cents,
      item.gerimmo_rating,
      item.administrative_documents_valid,
    ),
    ...item,
  }));

  const insertItems = await supabase.from("incident_quote_comparison_items").insert(enrichedItems as never);
  if (insertItems.error) {
    throw insertItems.error;
  }

  // L'erreur de cette RPC était déclarée puis jetée : en cas d'échec, le comparatif était
  // créé SANS recommandation et l'utilisateur voyait un tableau muet, sans explication.
  // recommendQuoteComparison() teste bien cette erreur — l'incohérence était un oubli.
  const recommendation = await (
    supabase as never as { rpc: (name: string, params: Record<string, string>) => Promise<{ error: Error | null }> }
  ).rpc("recommend_incident_quote", { target_comparison_id: comparison.id });
  if (recommendation.error) throw recommendation.error;

  return comparison;
}

export async function recommendQuoteComparison(comparisonId: string) {
  const supabase = await createClient();
  const comparison = await supabase
    .from("incident_quote_comparisons")
    .select("quote_request_id")
    .eq("id", comparisonId)
    .single();
  if (comparison.error) throw comparison.error;
  await narrowToSupervisionScopeQuoteRequest((comparison.data as { quote_request_id: string }).quote_request_id);
  const { data, error } = await (
    supabase as never as {
      rpc: (name: string, params: Record<string, string>) => Promise<{ data: string; error: Error | null }>;
    }
  ).rpc("recommend_incident_quote", { target_comparison_id: comparisonId });

  if (error) {
    throw error;
  }

  return data;
}

export async function decideQuoteComparison(input: DecideComparisonInput) {
  const supabase = await createClient();
  const comparison = await supabase
    .from("incident_quote_comparisons")
    .select("id,organization_id,quote_request_id")
    .eq("id", input.comparison_id)
    .single();

  if (comparison.error) {
    throw comparison.error;
  }
  await narrowToSupervisionScopeQuoteRequest((comparison.data as { quote_request_id: string }).quote_request_id);

  if (input.decision === "cancel") {
    const { data, error } = await supabase
      .from("incident_quote_comparisons")
      .update({ status: "annule" } as never)
      .eq("id", input.comparison_id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as IncidentQuoteComparison;
  }

  if (!input.quote_id) {
    throw new Error("Un devis doit etre selectionne.");
  }

  const decisionMap = {
    accept: { comparisonStatus: "valide", decisionStatus: "accepte" },
    refuse: { comparisonStatus: "refuse", decisionStatus: "refuse" },
    complement: { comparisonStatus: "complement", decisionStatus: "complement" },
  } as const;
  const { comparisonStatus, decisionStatus } = decisionMap[input.decision];

  // C'est cette ligne qui porte la décision ET le commentaire de refus. Sans .select(), un
  // refus silencieux laissait le comparatif basculer (ligne suivante, protégée) pendant que
  // la justification écrite par le propriétaire disparaissait sans bruit.
  const itemUpdate = await supabase
    .from("incident_quote_comparison_items")
    .update({ decision_status: decisionStatus, decision_comment: input.comment ?? null } as never)
    .eq("comparison_id", input.comparison_id)
    .eq("quote_id", input.quote_id)
    .select("id");

  if (itemUpdate.error) {
    throw itemUpdate.error;
  }
  if (!itemUpdate.data?.length) {
    throw new Error("Decision non enregistree sur le devis du comparatif.");
  }

  const { data, error } = await supabase
    .from("incident_quote_comparisons")
    .update({ status: comparisonStatus, recommended_quote_id: input.quote_id } as never)
    .eq("id", input.comparison_id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IncidentQuoteComparison;
}
