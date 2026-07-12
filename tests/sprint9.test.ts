import { normalizeHeaders, parseCsv } from "../src/services/import-rules.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("analyse un CSV avec séparateurs et champs protégés", () => {
  const rows = parseCsv('entity_type;name;slug\nagency;"Agence, Paris";agence-paris\n');
  assert.deepEqual(rows[0], ["entity_type", "name", "slug"]);
  assert.equal(rows[1][1], "Agence, Paris");
});

test("normalise les colonnes françaises", () => {
  assert.deepEqual(normalizeHeaders(["Type entité", "Code Postal"]), ["type_entite", "code_postal"]);
});

test("le schéma Sprint 9 protège toutes les tables administratives", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260712090000_sprint9_administration_intelligence.sql"),
    "utf8",
  );
  for (const table of [
    "admin_impersonation_sessions",
    "data_import_jobs",
    "data_import_rows",
    "cms_articles",
    "business_recommendations",
    "organization_subscriptions",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("les recommandations restent explicables et soumises à décision", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260712090000_sprint9_administration_intelligence.sql"),
    "utf8",
  );
  assert.match(migration, /explanation text not null/);
  assert.match(migration, /evidence jsonb not null/);
  assert.match(migration, /reviewed_by uuid/);
  assert.match(migration, /decision_note text/);
});
