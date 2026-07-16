import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260716121000_multi_tenant_indexes.sql");

test("les tables multi-organisations disposent d'un index de premier niveau", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const indexes = migration.match(/create index if not exists [^;]+\(organization_id\);/g) ?? [];
  assert.equal(indexes.length, 46);
  assert.match(migration, /documents_org_idx|document_versions_org_idx/);
  assert.match(migration, /incident_intervention_reports_org_idx/);
  assert.match(migration, /communication_messages_org_idx/);
  assert.match(migration, /bot_attachments_org_idx/);
});
