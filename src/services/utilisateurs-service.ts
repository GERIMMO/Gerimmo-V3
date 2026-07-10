import { createHash, randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import type { InviteUserInput, UpdateUserInput, UsersPayload } from "@/types/utilisateurs";

type MemberRecord = {
  id: string;
  organization_id: string;
  profile_id: string;
  member_type: string;
  status: string;
  created_at: string;
  archived_at: string | null;
  profiles?: { email?: string | null; full_name?: string | null; phone?: string | null } | null;
  organizations?: { name?: string | null } | null;
  member_role_assignments?: Array<{ roles?: { key?: string | null; name?: string | null } | null }>;
  user_profile_details?: Array<{ job_title?: string | null; city?: string | null; last_seen_at?: string | null }>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function listUsers(): Promise<UsersPayload> {
  const supabase = await createClient();
  const [members, invitations, activities, statusHistory] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id,organization_id,profile_id,member_type,status,created_at,archived_at,profiles(id,email,full_name,phone),organizations(id,name),member_role_assignments(roles(key,name)),user_profile_details(job_title,city,last_seen_at)")
      .order("created_at", { ascending: false }),
    supabase.from("user_invitations").select("id,organization_id,email,full_name,member_type,role_key,status,expires_at,created_at").order("created_at", { ascending: false }),
    supabase.from("user_activity_logs").select("id,organization_id,profile_id,action,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("user_status_history").select("id,organization_id,profile_id,previous_status,next_status,created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  for (const result of [members, invitations, activities, statusHistory]) {
    if (result.error) {
      throw result.error;
    }
  }

  const users = ((members.data ?? []) as MemberRecord[]).map((member) => {
    const role = member.member_role_assignments?.[0]?.roles;
    const details = member.user_profile_details?.[0];
    return {
      id: member.id,
      profile_id: member.profile_id,
      organization_id: member.organization_id,
      organization_name: member.organizations?.name ?? "Organisation",
      full_name: member.profiles?.full_name ?? "Utilisateur",
      email: member.profiles?.email ?? "",
      phone: member.profiles?.phone ?? null,
      member_type: member.member_type,
      role_key: role?.key ?? "locataire",
      role_name: role?.name ?? "Role a definir",
      status: member.status,
      job_title: details?.job_title ?? null,
      city: details?.city ?? null,
      last_seen_at: details?.last_seen_at ?? null,
      created_at: member.created_at,
      archived_at: member.archived_at,
    };
  });

  return {
    users,
    invitations: invitations.data ?? [],
    activities: activities.data ?? [],
    statusHistory: statusHistory.data ?? [],
  } as UsersPayload;
}

export async function inviteUser(input: InviteUserInput) {
  const supabase = await createClient();
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await supabase
    .from("user_invitations")
    .insert({ ...input, token_hash: hashToken(token), expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() } as never)
    .select("id,organization_id,email,full_name,member_type,role_key,status,expires_at,created_at")
    .single();

  if (error) throw error;
  return { invitation: data, secureLink: `/activation/${token}` };
}

export async function updateUser(input: UpdateUserInput) {
  const supabase = await createClient();

  if (input.full_name !== undefined || input.phone !== undefined) {
    const { error } = await supabase.from("profiles").update({ full_name: input.full_name, phone: input.phone } as never).eq("id", input.profile_id);
    if (error) throw error;
  }

  if (input.job_title !== undefined || input.city !== undefined) {
    const { error } = await supabase.from("user_profile_details").upsert({ profile_id: input.profile_id, organization_id: input.organization_id, job_title: input.job_title, city: input.city } as never, { onConflict: "profile_id,organization_id" });
    if (error) throw error;
  }

  if (input.status) {
    const { error } = await supabase
      .from("organization_members")
      .update({ status: input.status === "inactive" ? "suspended" : input.status, archived_at: input.status === "archived" ? new Date().toISOString() : null } as never)
      .eq("profile_id", input.profile_id)
      .eq("organization_id", input.organization_id);
    if (error) throw error;
  }

  return listUsers();
}
