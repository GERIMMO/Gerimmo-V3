import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminSubscriptionRow,
  BusinessAnalytics,
  BusinessPayload,
  OnboardingPayload,
  PromotionCode,
} from "@/types/business";

async function currentOrganization() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  return { supabase, user: auth.user, organizationId: membership?.organization_id ?? null };
}

export async function getBusinessPayload(organizationId?: string): Promise<BusinessPayload> {
  const { supabase, organizationId: ownOrganization } = await currentOrganization();
  const target = organizationId ?? ownOrganization;
  const [plans, subscription, organization] = await Promise.all([
    supabase
      .from("subscription_plans" as never)
      .select("*")
      .eq("is_active", true)
      .is("archived_at", null)
      .order("billing_interval"),
    target
      ? supabase
          .from("organization_subscriptions" as never)
          .select("*")
          .eq("organization_id", target)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    target
      ? supabase
          .from("organizations" as never)
          .select("organization_type")
          .eq("id", target)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (plans.error || subscription.error || organization.error) {
    throw plans.error ?? subscription.error ?? organization.error;
  }
  const subscriptionId = (subscription.data as { id?: string } | null)?.id;
  const [history, invoices] = subscriptionId
    ? await Promise.all([
        supabase
          .from("subscription_history" as never)
          .select("*")
          .eq("subscription_id", subscriptionId)
          .order("created_at", { ascending: false }),
        supabase
          .from("billing_invoices" as never)
          .select("*")
          .eq("subscription_id", subscriptionId)
          .order("created_at", { ascending: false }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (history.error || invoices.error) throw history.error ?? invoices.error;
  const organizationType = (organization.data as { organization_type?: string } | null)?.organization_type;
  let audience: "owner" | "agency" | null = null;
  if (organizationType === "independent_owner") audience = "owner";
  else if (organizationType) audience = "agency";
  const availablePlans = audience
    ? ((plans.data ?? []) as Array<{ audience?: string }>).filter((plan) => plan.audience === audience)
    : (plans.data ?? []);
  return {
    organizationId: target,
    plans: availablePlans as BusinessPayload["plans"],
    subscription: subscription.data as BusinessPayload["subscription"],
    history: (history.data ?? []) as BusinessPayload["history"],
    invoices: (invoices.data ?? []) as BusinessPayload["invoices"],
  };
}

export async function startTrial(planId: string, organizationId?: string) {
  const { supabase, organizationId: ownOrganization } = await currentOrganization();
  const target = organizationId ?? ownOrganization;
  if (!target) throw new Error("Organisation requise.");
  const { data, error } = await supabase.rpc(
    "start_organization_trial" as never,
    { target_organization_id: target, target_plan_id: planId } as never,
  );
  if (error) throw error;
  return data;
}

export async function administerSubscription(
  subscriptionId: string,
  action: "extend_trial" | "offer_month" | "suspend" | "reactivate" | "cancel",
  promotionCode?: string,
) {
  const supabase = await createClient();
  if (promotionCode) {
    const { data, error } = await supabase.rpc(
      "apply_promotion_code" as never,
      { target_subscription_id: subscriptionId, submitted_code: promotionCode } as never,
    );
    if (error) throw error;
    return data;
  }
  if (action === "extend_trial" || action === "offer_month") {
    const admin = createAdminClient();
    const field = action === "extend_trial" ? "trial_ends_at" : "current_period_end";
    const current = await admin
      .from("organization_subscriptions")
      .select(`id,${field}`)
      .eq("id", subscriptionId)
      .single();
    if (current.error) throw current.error;
    const base = new Date(String((current.data as Record<string, unknown>)[field] ?? new Date().toISOString()));
    base.setDate(base.getDate() + (action === "extend_trial" ? 14 : 30));
    const updated = await admin
      .from("organization_subscriptions")
      .update({ [field]: base.toISOString() })
      .eq("id", subscriptionId)
      .select("*")
      .single();
    if (updated.error) throw updated.error;
    return updated.data;
  }
  let targetStatus = "cancelled";
  if (action === "suspend") targetStatus = "suspended";
  else if (action === "reactivate") targetStatus = "active";
  const { data, error } = await supabase.rpc(
    "transition_subscription" as never,
    {
      target_subscription_id: subscriptionId,
      target_status: targetStatus,
      transition_reason: `Action Super Admin : ${action}`,
      transition_source: "super_admin",
    } as never,
  );
  if (error) throw error;
  return data;
}

export async function getOnboarding(): Promise<OnboardingPayload> {
  const { supabase, organizationId } = await currentOrganization();
  if (!organizationId) {
    const { data: steps, error } = await supabase
      .from("onboarding_steps" as never)
      .select("*")
      .order("sort_order");
    if (error) throw error;
    return {
      organizationId: "",
      progress: 0,
      steps: ((steps ?? []) as Array<Record<string, unknown>>).map((step) => ({
        ...step,
        status: "pending",
      })) as OnboardingPayload["steps"],
    };
  }
  const [steps, progress] = await Promise.all([
    supabase
      .from("onboarding_steps" as never)
      .select("*")
      .order("sort_order"),
    supabase
      .from("organization_onboarding_progress" as never)
      .select("*")
      .eq("organization_id", organizationId),
  ]);
  if (steps.error || progress.error) throw steps.error ?? progress.error;
  const progressByStep = new Map(
    ((progress.data ?? []) as Array<{ step_id: string; status: string }>).map((item) => [item.step_id, item.status]),
  );
  const mapped = ((steps.data ?? []) as Array<Record<string, unknown>>).map((step) => ({
    ...step,
    status: progressByStep.get(String(step.id)) ?? "pending",
  })) as OnboardingPayload["steps"];
  return {
    organizationId,
    progress: mapped.length
      ? Math.round((mapped.filter((step) => step.status === "completed").length / mapped.length) * 100)
      : 0,
    steps: mapped,
  };
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  planId: string;
  organizationType: "agency" | "independent_owner";
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentification requise.");
  const admin = createAdminClient();
  const existing = await admin
    .from("organization_members")
    .select("id")
    .eq("profile_id", auth.user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (existing.data) throw new Error("Votre compte appartient déjà à une organisation.");
  const planAudience = input.organizationType === "agency" ? "agency" : "owner";
  const plan = await admin
    .from("subscription_plans")
    .select("*")
    .eq("id", input.planId)
    .eq("audience", planAudience)
    .eq("is_active", true)
    .single();
  if (plan.error) throw new Error("Cette offre ne correspond pas au type de compte choisi.");
  const organization = await admin
    .from("organizations")
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      organization_type: input.organizationType,
      status: "active",
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (organization.error) throw organization.error;
  const isAgency = input.organizationType === "agency";
  const member = await admin
    .from("organization_members")
    .insert({
      organization_id: organization.data.id,
      profile_id: auth.user.id,
      member_type: isAgency ? "admin" : "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (member.error) throw member.error;
  const role = await admin
    .from("roles")
    .select("id")
    .eq("key", isAgency ? "administrateur_agence" : "proprietaire")
    .single();
  if (role.error) throw role.error;
  await admin
    .from("member_role_assignments")
    .insert({ organization_member_id: member.data.id, role_id: role.data.id, assigned_by: auth.user.id });
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + plan.data.trial_days * 86400000);
  const trial = await admin
    .from("organization_subscriptions")
    .insert({
      organization_id: organization.data.id,
      plan_id: input.planId,
      plan_key: plan.data.code,
      billing_interval: plan.data.billing_interval,
      status: "trial",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEndsAt.toISOString(),
    })
    .select("id")
    .single();
  if (trial.error) throw trial.error;
  await Promise.all([
    admin.from("subscription_history").insert({
      organization_id: organization.data.id,
      subscription_id: trial.data.id,
      previous_status: null,
      next_status: "trial",
      reason: "Démarrage de l’essai gratuit de 14 jours",
      actor_profile_id: auth.user.id,
      source: "onboarding",
    }),
    admin.from("automation_events").insert({
      organization_id: organization.data.id,
      event_type: "trial.started",
      aggregate_type: "subscription",
      aggregate_id: trial.data.id,
      payload: { ends_at: trialEndsAt.toISOString() },
      idempotency_key: `trial.started:${trial.data.id}`,
    }),
  ]);
  const steps = await admin.from("onboarding_steps").select("id,code");
  if (steps.data)
    await admin.from("organization_onboarding_progress").insert(
      steps.data.map((step) => ({
        organization_id: organization.data.id,
        step_id: step.id,
        status: ["account", "organization"].includes(step.code) ? "completed" : "pending",
        completed_by: ["account", "organization"].includes(step.code) ? auth.user.id : null,
        completed_at: ["account", "organization"].includes(step.code) ? new Date().toISOString() : null,
      })),
    );
  return organization.data;
}

export async function updateOnboardingStep(stepId: string, status: "in_progress" | "completed" | "skipped") {
  const { supabase, user, organizationId } = await currentOrganization();
  if (!organizationId) throw new Error("Organisation requise.");
  const { data, error } = await supabase
    .from("organization_onboarding_progress" as never)
    .upsert(
      {
        organization_id: organizationId,
        step_id: stepId,
        status,
        completed_by: status === "completed" ? user.id : null,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      } as never,
      { onConflict: "organization_id,step_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getBusinessAnalytics(): Promise<BusinessAnalytics> {
  const admin = createAdminClient();
  const [organizations, subscriptions, invoices] = await Promise.all([
    admin.from("organizations").select("id,created_at").eq("organization_type", "agency").is("archived_at", null),
    admin.from("organization_subscriptions").select("status,created_at,cancelled_at"),
    admin.from("billing_invoices").select("total_cents,paid_at,status"),
  ]);
  const all = subscriptions.data ?? [];
  const active = all.filter((item) => item.status === "active").length;
  const trials = all.filter((item) => item.status === "trial").length;
  const cancelled = all.filter((item) => item.status === "cancelled").length;
  const paid = (invoices.data ?? []).filter((item) => item.status === "paid");
  const now = new Date();
  const monthlyRevenueCents = paid
    .filter(
      (item) =>
        item.paid_at &&
        new Date(item.paid_at).getMonth() === now.getMonth() &&
        new Date(item.paid_at).getFullYear() === now.getFullYear(),
    )
    .reduce((sum, item) => sum + item.total_cents, 0);
  const annualRevenueCents = paid
    .filter((item) => item.paid_at && new Date(item.paid_at).getFullYear() === now.getFullYear())
    .reduce((sum, item) => sum + item.total_cents, 0);
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentOrganizations = (organizations.data ?? []).filter(
    (item) => new Date(item.created_at) >= new Date(now.getFullYear(), now.getMonth(), 1),
  ).length;
  const previousOrganizations = (organizations.data ?? []).filter((item) => {
    const date = new Date(item.created_at);
    return date >= previousMonth && date < new Date(now.getFullYear(), now.getMonth(), 1);
  }).length;
  let growthRate = 0;
  if (previousOrganizations) {
    growthRate = Math.round(((currentOrganizations - previousOrganizations) / previousOrganizations) * 1000) / 10;
  } else if (currentOrganizations) growthRate = 100;
  return {
    activeAgencies: active,
    trials,
    conversionRate: active + trials ? Math.round((active / (active + trials)) * 1000) / 10 : 0,
    monthlyRevenueCents,
    annualRevenueCents,
    subscriptions: all.length,
    growthRate,
    churnRate: all.length ? Math.round((cancelled / all.length) * 1000) / 10 : 0,
  };
}

export async function getAdminBusinessPayload() {
  const [analytics, subscriptions, promotions] = await Promise.all([
    getBusinessAnalytics(),
    createAdminClient()
      .from("organization_subscriptions")
      .select("*,organizations(name,organization_type),subscription_plans(name)")
      .order("created_at", { ascending: false }),
    createAdminClient()
      .from("promotion_codes")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (subscriptions.error || promotions.error) throw subscriptions.error ?? promotions.error;
  return {
    analytics,
    subscriptions: (subscriptions.data ?? []) as AdminSubscriptionRow[],
    promotions: (promotions.data ?? []) as PromotionCode[],
  };
}

export async function createPromotionCode(input: {
  code: string;
  campaign?: string;
  discountType: "percent" | "fixed" | "free_month";
  discountValue: number;
  expiresAt?: string;
}) {
  await import("./administration-service").then(({ requireSuperAdmin }) => requireSuperAdmin());
  const { data, error } = await createAdminClient()
    .from("promotion_codes")
    .insert({
      code: input.code.trim().toUpperCase(),
      campaign: input.campaign?.trim() || null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
