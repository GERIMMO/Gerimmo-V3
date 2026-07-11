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
  updated_at: string | null;
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
  restore?: boolean;
};
