import type { BotBrandIdentity } from "../../types/organization-branding.ts";

export const gerimmoIdentity: BotBrandIdentity = {
  customized: false,
  displayName: "GERIMMO",
  logoUrl: null,
  welcomeMessage: "Bienvenue dans l assistance GERIMMO.",
  supportSignature: "L equipe GERIMMO",
  supportEmail: null,
  supportPhone: null,
  openingHours: null,
};

export function roleRequiresGerimmo(roleKey: string | null) {
  return roleKey === "artisan" || roleKey === "contractor";
}

export function applyBrandIdentity(text: string, identity: BotBrandIdentity) {
  const contact = [identity.supportEmail, identity.supportPhone, identity.openingHours].filter(Boolean).join(" · ");
  return [text, identity.supportSignature, contact || null].filter(Boolean).join("\n\n");
}
