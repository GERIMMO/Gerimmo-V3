import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260716130000_data_deduplication.sql", import.meta.url);

test("les anciennes liaisons Telegram sont archivees sans suppression", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /update public\.telegram_accounts/);
  assert.match(sql, /status in \('revoked', 'archived'\)/);
  assert.match(sql, /normalize_telegram_account_archive/);
  assert.doesNotMatch(sql, /delete from public\.telegram_accounts/);
});

test("les doublons de planification sont consolides avec leur historique", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /gerimmo_duplicate_schedule_responses/);
  assert.match(sql, /insert into public\.audit_logs/);
  assert.match(sql, /'DEDUPLICATE'/);
  assert.match(sql, /update public\.incident_schedule_events/);
  assert.match(sql, /deduplicated_response_id/);
  assert.match(sql, /delete from public\.incident_schedule_responses/);
});

test("les doubles soumissions rapprochees sont bloquees", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /interval '5 seconds'/);
  assert.match(sql, /incident_schedule_responses_prevent_duplicate/);
  assert.match(sql, /revoke all on function public\.prevent_duplicate_incident_schedule_response/);
  assert.match(sql, /schedule_request_id, created_at desc/);
});
