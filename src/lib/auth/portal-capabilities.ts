import type { SupervisionTargetType } from "@/types/supervision";

export type PortalCapability =
  | "view:dashboard"
  | "view:tasks"
  | "view:incidents"
  | "view:properties"
  | "manage:properties"
  | "view:users"
  | "manage:users"
  | "view:contractors"
  | "view:documents"
  | "view:communication"
  | "view:reports"
  | "manage:settings"
  | "manage:subscription"
  | "supervise:owner"
  | "supervise:property"
  | "supervise:tenant"
  | "supervise:contractor"
  | "supervise:user";

const portalCapabilities = {
  agency: [
    "view:dashboard",
    "view:tasks",
    "view:incidents",
    "view:properties",
    "manage:properties",
    "view:users",
    "manage:users",
    "view:contractors",
    "view:documents",
    "view:communication",
    "view:reports",
    "manage:settings",
    "manage:subscription",
    "supervise:owner",
    "supervise:property",
    "supervise:tenant",
    "supervise:contractor",
    "supervise:user",
  ],
  owner: [
    "view:dashboard",
    "view:tasks",
    "view:incidents",
    "view:properties",
    "manage:properties",
    "view:users",
    "manage:users",
    "view:contractors",
    "view:documents",
    "view:communication",
    "view:reports",
    "manage:settings",
    "manage:subscription",
    "supervise:property",
    "supervise:tenant",
  ],
  property: [
    "view:dashboard",
    "view:incidents",
    "view:properties",
    "view:users",
    "view:documents",
    "view:reports",
    "supervise:tenant",
  ],
  tenant: ["view:dashboard", "view:incidents", "view:documents", "view:communication"],
  contractor: ["view:dashboard", "view:tasks", "view:incidents", "view:documents", "view:communication"],
  user: ["view:dashboard", "view:tasks", "view:incidents", "view:documents", "view:communication"],
} as const satisfies Readonly<Record<SupervisionTargetType, readonly PortalCapability[]>>;

const navigationByCapability: Readonly<Record<string, PortalCapability>> = {
  accueil: "view:dashboard",
  "a-faire": "view:tasks",
  incidents: "view:incidents",
  biens: "view:properties",
  utilisateurs: "view:users",
  locataires: "view:users",
  proprietaires: "view:users",
  artisans: "view:contractors",
  documents: "view:documents",
  echanges: "view:communication",
  notifications: "view:communication",
  rapports: "view:reports",
  parametres: "manage:settings",
  abonnement: "manage:subscription",
  "signaler-probleme": "view:dashboard",
};

export const portalLabels: Readonly<Record<SupervisionTargetType, string>> = {
  agency: "PORTAIL AGENCE",
  owner: "PORTAIL PROPRIÉTAIRE",
  property: "DOSSIER DU BIEN",
  tenant: "PORTAIL LOCATAIRE",
  contractor: "PORTAIL ARTISAN",
  user: "PORTAIL UTILISATEUR",
};

export function getPortalCapabilities(type: SupervisionTargetType): readonly PortalCapability[] {
  return portalCapabilities[type];
}

export function hasPortalCapability(type: SupervisionTargetType, capability: PortalCapability) {
  return (portalCapabilities[type] as readonly PortalCapability[]).includes(capability);
}

export function getPortalNavigationIds(type: SupervisionTargetType): readonly string[] {
  return Object.entries(navigationByCapability)
    .filter(([, capability]) => hasPortalCapability(type, capability))
    .map(([id]) => id);
}

export function memberTypeToPortalType(memberType: string | null | undefined): SupervisionTargetType {
  if (memberType === "owner") return "owner";
  if (memberType === "tenant") return "tenant";
  if (memberType === "contractor") return "contractor";
  if (memberType === "admin" || memberType === "agent") return "agency";
  return "user";
}

export function canEnterPortal(current: SupervisionTargetType, target: SupervisionTargetType) {
  return hasPortalCapability(current, `supervise:${target}` as PortalCapability);
}
