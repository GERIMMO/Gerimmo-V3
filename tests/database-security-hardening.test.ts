import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260716120000_database_security_hardening.sql");

test("les acces anonymes implicites sont revoques", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /revoke all privileges on all tables in schema public from anon/);
  assert.match(migration, /revoke execute on all functions in schema public from public, anon/);
  assert.match(migration, /alter default privileges[\s\S]+revoke execute on functions from public, anon/);
});

test("les RPC sensibles ont une autorisation explicite", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /revoke execute on function public\.evaluate_subscription_lifecycle\(\) from public, anon, authenticated/,
  );
  assert.match(migration, /grant execute on function public\.evaluate_subscription_lifecycle\(\) to service_role/);
  assert.match(migration, /if not public\.can_manage_incidents\(comparison_organization_id\)/);
  assert.match(migration, /raise exception 'ACCESS_DENIED'/);
});

test("la vue des notes artisans respecte la RLS", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /with \(security_invoker = true\)/);
  assert.match(migration, /revoke all privileges on public\.incident_artisan_rating_statistics from public, anon/);
});
