import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("les pieces jointes d'incident sont lisibles uniquement dans le perimetre autorise", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260716122000_incident_storage_policy.sql"),
    "utf8",
  );
  assert.match(migration, /bucket_id = 'incident-attachments'/);
  assert.match(migration, /attachment\.storage_path = name/);
  assert.match(migration, /can_access_bot_data\(attachment\.organization_id, attachment\.profile_id\)/);
  assert.doesNotMatch(migration, /to anon/);
});

test("les relations des parcours principaux sont indexees sans indexer les colonnes d'archivage", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260716123000_relationship_indexes.sql"),
    "utf8",
  );
  const indexes = migration.match(/create index if not exists/g) ?? [];
  assert.equal(indexes.length, 23);
  assert.match(migration, /bot_attachments_conversation_idx/);
  assert.match(migration, /documents_patrimoine_idx/);
  assert.match(migration, /incident_interventions_schedule_request_idx/);
  assert.doesNotMatch(migration, /archived_by/);
});
