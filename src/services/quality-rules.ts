import type { QualityAnalysis, QualityPriority, QualityReport, QualitySeverity } from "@/types/quality";

const moduleMap: Array<{ match: RegExp; module: string; files: string[] }> = [
  { match: /incident/i, module: "Incidents", files: ["src/services/incidents-service.ts", "src/app/api/incidents"] },
  {
    match: /document|storage/i,
    module: "Documents",
    files: ["src/services/documents-service.ts", "src/app/api/documents"],
  },
  {
    match: /telegram|bot/i,
    module: "Telegram",
    files: ["src/services/telegram-bot-service.ts", "src/app/api/bot/telegram"],
  },
  {
    match: /stripe|paiement|factur/i,
    module: "Abonnements",
    files: ["src/services/stripe-service.ts", "src/app/api/stripe"],
  },
  {
    match: /auth|connexion|invitation/i,
    module: "Authentification",
    files: ["src/app/(main)/auth/actions.ts", "src/lib/supabase/middleware.ts"],
  },
  { match: /n8n|workflow/i, module: "Automatisations", files: ["n8n/workflows", "src/app/api/automations"] },
];

export function severityFromPriority(priority: QualityPriority, hasSecuritySignal: boolean): QualitySeverity {
  if (priority === "critical" || hasSecuritySignal) return "critical";
  if (priority === "high") return "high";
  if (priority === "normal") return "medium";
  return "low";
}

export function analyzeQualityReport(report: QualityReport, events: Array<Record<string, unknown>>): QualityAnalysis {
  const context = `${report.title} ${report.description} ${report.screen_path ?? ""} ${report.api_path ?? ""}`;
  const matches = moduleMap.filter((entry) => entry.match.test(context));
  const hasSecuritySignal = /permission|accès|secret|token|donnée.*autre|401|403/i.test(context);
  const repeatedErrors = events.filter((event) => ["error", "critical"].includes(String(event.severity))).length;
  let likelySource = "browser";
  if (events[0]?.source) likelySource = String(events[0].source);
  else if (report.api_path) likelySource = "api";
  return {
    report_id: report.id,
    probable_cause: repeatedErrors
      ? `${repeatedErrors} erreur(s) corrélée(s) provenant de ${likelySource}. Une vérification du dernier événement est requise.`
      : "Aucune erreur corrélée suffisante. Reproduction contrôlée et consultation des journaux requises.",
    severity: severityFromPriority(report.priority, hasSecuritySignal),
    affected_modules: matches.length ? matches.map((entry) => entry.module) : ["Plateforme"],
    affected_files: matches.flatMap((entry) => entry.files),
    affected_workflows: /n8n|workflow/i.test(context) ? ["Workflow à identifier depuis la corrélation"] : [],
    impacted_users_estimate: Math.max(1, repeatedErrors),
    business_impact:
      report.priority === "critical"
        ? "Parcours utilisateur potentiellement bloqué."
        : "Dégradation localisée à confirmer.",
    security_impact: hasSecuritySignal
      ? "Signal de sécurité détecté, revue humaine obligatoire."
      : "Aucun impact de sécurité établi.",
    performance_impact: events.some((event) => Number(event.duration_ms) > 1500)
      ? "Latence supérieure au seuil de 1,5 seconde."
      : "Aucune dégradation mesurée.",
    confidence_percent: Math.min(90, 35 + repeatedErrors * 10 + matches.length * 10),
    evidence: events.slice(0, 20),
  };
}

export function sensitiveAreas(files: string[], tables: string[], workflows: string[]) {
  const context = [...files, ...tables, ...workflows].join(" ");
  return [
    ["SQL / migrations", /migration|\.sql/i],
    ["Permissions / authentification", /auth|permission|rls/i],
    ["Stripe", /stripe/i],
    ["Telegram", /telegram/i],
    ["n8n", /n8n|workflow/i],
    ["Storage / Documents", /storage|document/i],
  ]
    .filter(([, pattern]) => (pattern as RegExp).test(context))
    .map(([label]) => label as string);
}
