export type OrganizationBranding = {
  id: string | null;
  organization_id: string;
  organization_name: string;
  is_agency: boolean;
  branding_enabled: boolean;
  display_name: string | null;
  logo_url: string | null;
  welcome_message: string | null;
  support_signature: string | null;
  support_email: string | null;
  support_phone: string | null;
  opening_hours: string | null;
  primary_color: string | null;
  official_signature: string | null;
  updated_at: string | null;
  /** Identité légale — lue depuis `organizations`, reprise sur les documents officiels. */
  legal: OrganizationLegalIdentity;
};

/**
 * Identité légale de l'organisation, telle qu'elle figure sur les quittances et courriers.
 * Distincte du branding visuel (logo, couleurs) : elle concerne aussi les propriétaires
 * indépendants, pas seulement les agences.
 */
export type OrganizationLegalIdentity = {
  legal_name: string | null;
  siren: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type OrganizationLegalIdentityInput = OrganizationLegalIdentity & {
  organization_id: string;
};

export type BotBrandIdentity = {
  customized: boolean;
  displayName: string;
  logoUrl: string | null;
  welcomeMessage: string;
  supportSignature: string;
  supportEmail: string | null;
  supportPhone: string | null;
  openingHours: string | null;
};

export type OrganizationBrandingInput = {
  organization_id: string;
  branding_enabled: boolean;
  display_name?: string | null;
  logo_url?: string | null;
  welcome_message?: string | null;
  support_signature?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
  opening_hours?: string | null;
  primary_color?: string | null;
  official_signature?: string | null;
  restore?: boolean;
};
