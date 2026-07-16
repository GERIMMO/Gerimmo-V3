export type UserMemberType = "admin" | "agent" | "owner" | "contractor" | "tenant";
export type UserStatus = "invited" | "active" | "inactive" | "suspended" | "archived";

export type GerimmoUser = {
  id: string;
  profile_id: string;
  organization_id: string;
  organization_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  member_type: UserMemberType;
  role_key: string;
  role_name: string;
  status: UserStatus;
  job_title: string | null;
  city: string | null;
  last_seen_at: string | null;
  created_at: string;
  archived_at: string | null;
};

export type UserInvitation = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  member_type: UserMemberType;
  role_key: string;
  status: "pending" | "accepted" | "expired" | "revoked" | "archived";
  expires_at: string;
  created_at: string;
};

export type UserActivity = {
  id: string;
  organization_id: string | null;
  profile_id: string | null;
  action: string;
  created_at: string;
};

export type UserStatusHistory = {
  id: string;
  organization_id: string;
  profile_id: string | null;
  previous_status: UserStatus | null;
  next_status: UserStatus;
  created_at: string;
};

export type UsersPayload = {
  organizationId: string | null;
  users: GerimmoUser[];
  invitations: UserInvitation[];
  activities: UserActivity[];
  statusHistory: UserStatusHistory[];
};

export type InviteUserInput = {
  organization_id: string;
  email: string;
  full_name?: string;
  member_type: UserMemberType;
  role_key: string;
};

export type UpdateUserInput = {
  profile_id: string;
  organization_id: string;
  full_name?: string;
  phone?: string | null;
  job_title?: string | null;
  city?: string | null;
  role_key?: string;
  status?: UserStatus;
};
