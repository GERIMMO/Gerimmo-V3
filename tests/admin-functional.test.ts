import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260716190000_super_admin_business_modules.sql", "utf8");
const page = readFileSync("src/app/(main)/admin/[section]/page.tsx", "utf8");
const api = readFileSync("src/app/api/admin/modules/[section]/route.ts", "utf8");
const service = readFileSync("src/services/admin-functional-service.ts", "utf8");

test("les nouvelles tables Super Admin activent la RLS", () => {
  const tables = [
    "admin_support_requests",
    "product_ideas",
    "admin_communications",
    "admin_communication_templates",
    "system_integrations",
    "automation_workflows",
    "admin_ai_recommendations",
  ];
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("les mutations API vérifient le rôle Super Admin", () => {
  assert.match(api, /requireSuperAdminApi/);
  assert.match(service, /requireSuperAdmin\(\)/);
});

test("les routes fonctionnelles ne pointent plus vers les anciennes consoles génériques", () => {
  for (const section of ["subscriptions", "promotion-codes", "bugs", "alerts", "system-health", "ai-center"]) {
    assert.match(page, new RegExp(`"${section}"`));
  }
  assert.doesNotMatch(page, /BusinessPage|MarketingPage|QualityPage/);
});

test("les décisions IA restent soumises à validation humaine", () => {
  assert.match(migration, /admin_ai_status_valid/);
  assert.match(service, /ai_decision/);
  assert.doesNotMatch(service, /apply_ai_recommendation|execute_ai_recommendation/);
});

test("la publication multicanale utilise une file idempotente", () => {
  assert.match(service, /communication\.publish/);
  assert.match(service, /idempotency_key/);
  assert.match(migration, /requires_acknowledgement/);
});
