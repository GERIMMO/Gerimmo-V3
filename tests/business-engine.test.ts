import { addTrialDays, canUsePlatform, planForPortfolio } from "../src/services/business-rules.ts";
import type { SubscriptionPlan } from "../src/types/business.ts";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const plan = (audience: "owner" | "agency", min: number, max: number | null): SubscriptionPlan => ({
  id: `${audience}-${min}`,
  code: `${audience}-${min}`,
  name: "Offre",
  description: null,
  billing_interval: "monthly",
  amount_cents: 1900,
  setup_fee_cents: 4900,
  annual_fee_cents: 7900,
  currency: "eur",
  trial_days: 14,
  stripe_price_id: null,
  is_purchasable: false,
  audience,
  min_properties: min,
  max_properties: max,
  requires_quote: false,
  features: [],
});

test("l'essai gratuit dure exactement 14 jours", () => {
  const start = new Date("2026-07-12T12:00:00.000Z");
  assert.equal(addTrialDays(start).toISOString(), "2026-07-26T12:00:00.000Z");
});

test("la suspension bloque l'usage sans effacer les donnees", () => {
  assert.equal(canUsePlatform("trial"), true);
  assert.equal(canUsePlatform("active"), true);
  assert.equal(canUsePlatform("suspended"), false);
});

test("les offres correspondent au type et au nombre de biens", () => {
  const plans = [plan("owner", 1, 5), plan("owner", 6, 20), plan("agency", 1, 50)];
  assert.equal(planForPortfolio(plans, "owner", 12)?.min_properties, 6);
  assert.equal(planForPortfolio(plans, "agency", 12)?.audience, "agency");
});

test("la migration contient toute la grille officielle", async () => {
  const sql = await readFile(
    path.join(root, "supabase/migrations/20260712110100_sprint10_official_pricing.sql"),
    "utf8",
  );
  for (const amount of ["1900", "3900", "6900", "7900", "14900", "24900", "39900"])
    assert.match(sql, new RegExp(amount));
  assert.match(sql, /trial_days/);
  assert.match(sql, /'suspended'/);
});

test("les emails et workflows obligatoires sont presents", async () => {
  const emailSql = await readFile(
    path.join(root, "supabase/migrations/20260712110200_sprint10_email_templates.sql"),
    "utf8",
  );
  for (const code of [
    "welcome",
    "trial_started",
    "trial_ended",
    "payment_succeeded",
    "payment_failed",
    "invoice",
    "renewal",
    "suspension",
    "reactivation",
  ])
    assert.match(emailSql, new RegExp(code));
  const workflows = await readdir(path.join(root, "n8n/workflows"));
  assert.equal(workflows.length, 8);
  for (const workflow of workflows) JSON.parse(await readFile(path.join(root, "n8n/workflows", workflow), "utf8"));
});
