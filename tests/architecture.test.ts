import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(target) : Promise.resolve([target]);
    }),
  );
  return files.flat();
}

test("les routes dashboard et API sont protegees", async () => {
  const middleware = await readFile(path.join(root, "src/lib/supabase/middleware.ts"), "utf8");
  assert.match(middleware, /pathname\.startsWith\("\/dashboard"\)/);
  assert.match(middleware, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(middleware, /status: 401/);
  assert.match(middleware, /\/api\/bot\/telegram\/webhook/);
});

test("les ecrans actifs ne contiennent plus les identifiants de demonstration", async () => {
  const files = (await collectFiles(path.join(root, "src/app/(main)/dashboard"))).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  assert.equal(
    sources.some((source) => /org-demo|mockIncidents|mockUsers|Studio Admin/i.test(source)),
    false,
  );
});

test("le stockage documentaire reste prive et cloisonne", async () => {
  const migration = await readFile(
    path.join(root, "supabase/migrations/20260712010000_sprint8_storage_and_indexes.sql"),
    "utf8",
  );
  assert.match(migration, /values \('documents', 'documents', false/);
  assert.match(migration, /can_access_document/);
  assert.match(migration, /can_manage_documents/);
});

test("l'activation d'une invitation est transactionnelle", async () => {
  const migration = await readFile(
    path.join(root, "supabase/migrations/20260712011000_sprint8_invitation_activation.sql"),
    "utf8",
  );
  assert.match(migration, /for update/);
  assert.match(migration, /organization_members/);
  assert.match(migration, /member_role_assignments/);
  assert.match(migration, /INVITATION_ACCEPTED/);
});
