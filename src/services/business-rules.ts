import type { SubscriptionPlan, SubscriptionStatus } from "@/types/business";

export function addTrialDays(start: Date, days = 14) {
  return new Date(start.getTime() + days * 86_400_000);
}

export function planForPortfolio(plans: SubscriptionPlan[], audience: "owner" | "agency", propertyCount: number) {
  return plans.find(
    (plan) =>
      plan.audience === audience &&
      propertyCount >= plan.min_properties &&
      (plan.max_properties === null || propertyCount <= plan.max_properties),
  );
}

export function canUsePlatform(status: SubscriptionStatus) {
  return status === "trial" || status === "active";
}
