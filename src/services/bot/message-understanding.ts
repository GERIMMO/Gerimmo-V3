import type { BotClassification, BotIntent } from "@/types/telegram-bot";

type CategoryRule = {
  slug: string;
  keywords: string[];
};

const categoryRules: CategoryRule[] = [
  { slug: "plomberie", keywords: ["fuite", "robinet", "eau", "canalisation", "wc", "toilette", "evier"] },
  { slug: "electricite", keywords: ["electricite", "prise", "courant", "disjoncteur", "lumiere", "panne"] },
  { slug: "chauffage", keywords: ["chauffage", "radiateur", "chaudiere", "eau chaude", "froid"] },
  { slug: "serrurerie", keywords: ["serrure", "cle", "porte", "bloque", "fermeture"] },
  { slug: "parties-communes", keywords: ["ascenseur", "hall", "escalier", "parties communes"] },
  { slug: "administratif", keywords: ["administratif", "courrier", "attestation"] },
];

const intentRules: Array<{ intent: BotIntent; keywords: string[] }> = [
  { intent: "suivre_incident", keywords: ["suivre", "ou en est", "dossier", "avancement", "statut"] },
  { intent: "demander_document", keywords: ["document", "bail", "quittance", "etat des lieux", "reglement"] },
  { intent: "proposer_disponibilites", keywords: ["disponibilite", "creneau", "rendez-vous", "horaire"] },
  { intent: "aide", keywords: ["aide", "menu", "commande", "que peux-tu"] },
];

function normalize(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyMessage(input: string): BotClassification {
  const text = normalize(input);
  const explicitIntent = intentRules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
  const category = categoryRules
    .map((rule) => ({ ...rule, matches: rule.keywords.filter((keyword) => text.includes(keyword)) }))
    .sort((left, right) => right.matches.length - left.matches.length)[0];
  const matchedKeywords = category?.matches ?? [];
  const incidentIntent = matchedKeywords.length > 0 || /casse|probleme|degat|incident|reparation/.test(text);
  const intent = explicitIntent?.intent ?? (incidentIntent ? "declarer_incident" : "inconnu");
  let confidence = 0.2;
  if (matchedKeywords.length >= 2) confidence = 0.95;
  else if (matchedKeywords.length === 1) confidence = 0.8;
  else if (incidentIntent) confidence = 0.55;

  return {
    intent,
    categorySlug: matchedKeywords.length > 0 ? category.slug : null,
    confidence,
    matchedKeywords,
    needsClarification: intent === "inconnu" || (intent === "declarer_incident" && confidence < 0.7),
  };
}

export function parseAvailabilitySlots(input: string) {
  const matches = [...input.matchAll(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*[-a]\s*(\d{1,2}:\d{2})/gi)];

  return matches.map((match) => {
    const startsAt = new Date(`${match[1]}T${match[2]}:00`);
    const endsAt = new Date(`${match[1]}T${match[3]}:00`);
    return { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() };
  });
}

export const allowedTenantDocumentTypes = new Set(["contrat", "attestation", "quittance", "autre"]);
