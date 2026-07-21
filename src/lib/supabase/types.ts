export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type FoundationTable<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: never[];
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  organization_type: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
  legal_name: string | null;
  siren: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  profile_id: string;
  member_type: "admin" | "agent" | "owner" | "contractor" | "tenant";
  status: "invited" | "active" | "suspended" | "archived";
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
};

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: "global" | "organization";
  is_system: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
};

type PermissionRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
};

type RolePermissionRow = {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
};

type MemberRoleAssignmentRow = {
  id: string;
  organization_member_id: string;
  role_id: string;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: string | null;
};

type AuditLogRow = {
  id: string;
  organization_id: string | null;
  actor_profile_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: FoundationTable<ProfileRow>;
      organizations: FoundationTable<
        OrganizationRow,
        Omit<OrganizationRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by"> &
          Partial<Pick<OrganizationRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by">>
      >;
      organization_members: FoundationTable<
        OrganizationMemberRow,
        Omit<OrganizationMemberRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by"> &
          Partial<Pick<OrganizationMemberRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by">>
      >;
      roles: FoundationTable<
        RoleRow,
        Omit<RoleRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by"> &
          Partial<Pick<RoleRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by">>
      >;
      permissions: FoundationTable<
        PermissionRow,
        Omit<PermissionRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by"> &
          Partial<Pick<PermissionRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by">>
      >;
      role_permissions: FoundationTable<
        RolePermissionRow,
        Omit<RolePermissionRow, "id" | "created_at"> & Partial<Pick<RolePermissionRow, "id" | "created_at">>
      >;
      member_role_assignments: FoundationTable<
        MemberRoleAssignmentRow,
        Omit<MemberRoleAssignmentRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by"> &
          Partial<Pick<MemberRoleAssignmentRow, "id" | "created_at" | "updated_at" | "archived_at" | "archived_by">>
      >;
      audit_logs: FoundationTable<
        AuditLogRow,
        Omit<AuditLogRow, "id" | "created_at"> & Partial<Pick<AuditLogRow, "id" | "created_at">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      accept_user_invitation: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      audit_table_changes: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      can_access_organization_member: {
        Args: {
          target_member_id: string;
        };
        Returns: boolean;
      };
      can_access_profile: {
        Args: {
          target_profile_id: string;
        };
        Returns: boolean;
      };
      can_manage_organization: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      current_profile_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      has_organization_role: {
        Args: {
          role_keys: string[];
          target_organization_id: string;
        };
        Returns: boolean;
      };
      is_active_organization_member: {
        Args: {
          target_organization_id: string;
        };
        Returns: boolean;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      set_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
