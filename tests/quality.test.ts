import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { analyzeQualityReport, sensitiveAreas, severityFromPriority } from "../src/services/quality-rules.ts";
import type { QualityReport } from "../src/types/quality.ts";

const report: QualityReport = {
  id: "report",
  reference: "QUAL-TEST",
  organization_id: "org",
  reporter_profile_id: "user",
  title: "Erreur Telegram",
  description: "Le webhook Telegram retourne une erreur 403",
  priority: "high",
  status: "new",
  screen_path: "/dashboard/incidents",
  api_path: "/api/bot/telegram/webhook",
  browser_info: {},
  device_info: {},
  correlation_id: "correlation",
  created_at: new Date().toISOString(),
};

test("une alerte de sécurité devient critique", () => {
  assert.equal(severityFromPriority("normal", true), "critical");
});

test("l'analyse reste explicable et identifie les zones sensibles", () => {
  const analysis = analyzeQualityReport(report, [{ source: "telegram", severity: "error", message: "403" }]);
  assert.equal(analysis.severity, "critical");
  assert.ok(analysis.affected_modules.includes("Telegram"));
  assert.ok(sensitiveAreas(analysis.affected_files, [], analysis.affected_workflows).includes("Telegram"));
});

test("les corrections sensibles exigent une validation humaine", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260712200000_sprint11_production_ready.sql"),
    "utf8",
  );
  assert.match(sql, /requires_human_approval boolean not null default true/);
  assert.doesNotMatch(sql, /execute_correction|apply_correction/);
});
