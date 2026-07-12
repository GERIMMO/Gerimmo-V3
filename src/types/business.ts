export type SubscriptionStatus = "trial" | "active" | "suspended" | "expired" | "cancelled";
export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_interval: "monthly" | "annual";
  amount_cents: number | null;
  setup_fee_cents: number;
  annual_fee_cents: number;
  currency: string;
  trial_days: number;
  stripe_price_id: string | null;
  is_purchasable: boolean;
  audience: "owner" | "agency";
  min_properties: number;
  max_properties: number | null;
  requires_quote: boolean;
  features: string[];
};
export type OrganizationSubscription = {
  id: string;
  organization_id: string;
  plan_id: string | null;
  plan_key: string;
  billing_interval: "monthly" | "annual" | null;
  status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  next_invoice_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  discount_percent: number | null;
};
export type SubscriptionHistoryItem = {
  id: string;
  previous_status: SubscriptionStatus | null;
  next_status: SubscriptionStatus;
  reason: string;
  source: string;
  created_at: string;
};
export type BillingInvoice = {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
};
export type BusinessPayload = {
  organizationId: string | null;
  plans: SubscriptionPlan[];
  subscription: OrganizationSubscription | null;
  history: SubscriptionHistoryItem[];
  invoices: BillingInvoice[];
};
export type OnboardingStep = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  sort_order: number;
  action_url: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped";
};
export type OnboardingPayload = { organizationId: string; progress: number; steps: OnboardingStep[] };
export type BusinessAnalytics = {
  activeAgencies: number;
  trials: number;
  conversionRate: number;
  monthlyRevenueCents: number;
  annualRevenueCents: number;
  subscriptions: number;
  growthRate: number;
  churnRate: number;
};
export type AdminSubscriptionRow = OrganizationSubscription & {
  organizations: { name: string; organization_type: string } | null;
  subscription_plans: { name: string } | null;
};
export type PromotionCode = {
  id: string;
  code: string;
  campaign: string | null;
  discount_type: "percent" | "fixed" | "free_month";
  discount_value: number;
  expires_at: string | null;
  redemption_count: number;
  is_active: boolean;
};
