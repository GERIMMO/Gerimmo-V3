import { createClient } from "@/lib/supabase/server";
import type {
  CreateComparisonInput,
  DecideComparisonInput,
  IncidentQuoteComparison,
  IncidentQuoteComparisonItem,
  IncidentQuoteComparisonsPayload,
  IncidentQuoteValidationEvent,
} from "@/types/incident-quote-comparisons";

const futureLinks = {
  planification: null,
  intervention: null,
};

export function calculateRecommendationScore(priceCents: number, gerimmoRating: number, administrativeDocumentsValid: boolean) {
  return Number(((1000000 / Math.max(priceCents, 1)) * 0.45 + gerimmoRating * 20 * 0.35 + (administrativeDocumentsValid ? 20 : 0)).toFixed(4));
}

export async function listQuoteComparisons(): Promise<IncidentQuoteComparisonsPayload> {
  const supabase = await createClient();
  const [comparisons, items, events] = await Promise.all([
    supabase.from("incident_quote_comparisons").select("*").order("updated_at", { ascending: false }),
    supabase.from("incident_quote_comparison_items").select("*").order("recommendation_score", { ascending: false }),
    supabase.from("incident_quote_validation_events").select("id,organization_id,comparison_id,quote_id,actor_profile_id,action,comment,metadata,created_at").order("created_at", { ascending: false }).limit(300),
  ]);

  for (const result of [comparisons, items, events]) {
    if (result.error) {
      throw result.error;
    }
  }

  return {
    comparisons: (comparisons.data ?? []) as IncidentQuoteComparison[],
    items: (items.data ?? []) as IncidentQuoteComparisonItem[],
    events: (events.data ?? []) as IncidentQuoteValidationEvent[],
  };
}

export async function createQuoteComparison(input: CreateComparisonInput) {
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
    recommendation_score: calculateRecommendationScore(item.price_cents, item.gerimmo_rating, item.administrative_documents_valid),
    ...item,
  }));

  const insertItems = await supabase.from("incident_quote_comparison_items").insert(enrichedItems as never);
  if (insertItems.error) {
    throw insertItems.error;
  }

  await (supabase as never as { rpc: (name: string, params: Record<string, string>) => Promise<{ error: Error | null }> }).rpc(
    "recommend_incident_quote",
    { target_comparison_id: comparison.id }
  );

  return comparison;
}

export async function recommendQuoteComparison(comparisonId: string) {
  const supabase = await createClient();
  const { data, error } = await (
    supabase as never as { rpc: (name: string, params: Record<string, string>) => Promise<{ data: string; error: Error | null }> }
  ).rpc("recommend_incident_quote", { target_comparison_id: comparisonId });

  if (error) {
    throw error;
  }

  return data;
}

export async function decideQuoteComparison(input: DecideComparisonInput) {
  const supabase = await createClient();
  const comparison = await supabase.from("incident_quote_comparisons").select("id,organization_id,quote_request_id").eq("id", input.comparison_id).single();

  if (comparison.error) {
    throw comparison.error;
  }

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

  const itemUpdate = await supabase
    .from("incident_quote_comparison_items")
    .update({ decision_status: decisionStatus, decision_comment: input.comment ?? null } as never)
    .eq("comparison_id", input.comparison_id)
    .eq("quote_id", input.quote_id);

  if (itemUpdate.error) {
    throw itemUpdate.error;
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
