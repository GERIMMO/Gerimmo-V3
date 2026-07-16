import { agencyPlans, ownerPlans } from "../src/config/public-pricing.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("la grille publique reprend les tarifs officiels", () => {
  assert.deepEqual(
    ownerPlans.map((plan) => plan.monthly),
    [19, 39, 69],
  );
  assert.deepEqual(
    agencyPlans.map((plan) => plan.monthly),
    [79, 149, 249, 399, null],
  );
  assert.deepEqual(
    ownerPlans.map((plan) => plan.setup),
    [49, 49, 99],
  );
});

test("la demonstration ne contient aucune donnee sensible", async () => {
  const source = await readFile(path.join(process.cwd(), "src/config/demo-data.ts"), "utf8");
  assert.match(source, /Agence Horizon/);
  assert.doesNotMatch(source, /@|\b0[1-9](?:[ .-]?\d{2}){4}\b|supabase|service_role/i);
});

test("les pages commerciales sont indexables et le dashboard est exclu", async () => {
  const sitemap = await readFile(path.join(process.cwd(), "src/app/sitemap.ts"), "utf8");
  const robots = await readFile(path.join(process.cwd(), "src/app/robots.ts"), "utf8");
  for (const route of ["/tarifs", "/demonstration", "/aide", "/contact", "/pourquoi-gerimmo"])
    assert.match(sitemap, new RegExp(route));
  assert.match(robots, /\/dashboard\//);
  assert.match(robots, /\/api\//);
});

test("les prospects sont isoles du navigateur et consultables uniquement par le Super Admin", async () => {
  const migration = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260713100000_sprint12_go_to_market.sql"),
    "utf8",
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_super_admin\(\)/);
  assert.doesNotMatch(migration, /for select to anon/);
});
