import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { InviteUserInput, UpdateUserInput, UsersPayload } from "@/types/utilisateurs";

import {
  getSupervisionDataScope,
  narrowToSupervisionScopeManager,
  narrowToSupervisionScopeOrganization,
  narrowToSupervisionScopeProfile,
  recordSupervisionAction,
} from "./supervision-service";
import { createHash, randomBytes } from "node:crypto";

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
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function listUsers(): Promise<UsersPayload> {
  const supabase = await createClient();
  const [members, invitations, activities, statusHistory, profileDetails] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        // `profiles` doit être désambiguïsé : organization_members a TROIS clés étrangères
        // vers profiles (profile_id, invited_by, archived_by) et PostgREST refuse de choisir
        // (PGRST201). user_profile_details n'est pas imbriquable ici : aucune clé étrangère
        // ne relie les deux tables (PGRST200) — il est donc chargé séparément ci-dessous.
        "id,organization_id,profile_id,member_type,status,created_at,archived_at,profiles!organization_members_profile_id_fkey(id,email,full_name,phone),organizations(id,name),member_role_assignments(roles(key,name))",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("user_invitations")
      .select("id,organization_id,email,full_name,member_type,role_key,status,expires_at,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_activity_logs")
      .select("id,organization_id,profile_id,action,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("user_status_history")
      .select("id,organization_id,profile_id,previous_status,next_status,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("user_profile_details").select("profile_id,organization_id,job_title,city,last_seen_at"),
  ]);

  for (const result of [members, invitations, activities, statusHistory, profileDetails]) {
    if (result.error) {
      throw result.error;
    }
  }

  // Rattachement manuel des détails de profil, faute de relation exploitable par PostgREST.
  const detailsByMember = new Map(
    (
      (profileDetails.data ?? []) as Array<{
        profile_id: string;
        organization_id: string;
        job_title: string | null;
        city: string | null;
        last_seen_at: string | null;
      }>
    ).map((detail) => [`${detail.profile_id}:${detail.organization_id}`, detail]),
  );

  const supervision = await getSupervisionDataScope();
  const supervisedOrganizationId = supervision?.organizationId ?? null;
  const { data: auth } = await supabase.auth.getUser();
  const membership = auth.user
    ? await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", auth.user.id)
        .eq("status", "active")
        .is("archived_at", null)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (membership.error) throw membership.error;
  const organizationId = supervisedOrganizationId ?? membership.data?.organization_id ?? null;
  // Les types générés ne décrivent pas la relation member_role_assignments, que PostgREST
  // résout pourtant sans peine à l'exécution (clé étrangère organization_member_id).
  const users = ((members.data ?? []) as unknown as MemberRecord[])
    .filter(
      (member) =>
        !supervisedOrganizationId ||
        (member.organization_id === supervisedOrganizationId &&
          (!supervision?.profileIds || supervision.profileIds.includes(member.profile_id))),
    )
    .map((member) => {
      const role = member.member_role_assignments?.[0]?.roles;
      const details = detailsByMember.get(`${member.profile_id}:${member.organization_id}`);
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
    organizationId,
    users,
    invitations: ((invitations.data ?? []) as UsersPayload["invitations"]).filter(
      (item) => !supervisedOrganizationId || item.organization_id === supervisedOrganizationId,
    ),
    activities: ((activities.data ?? []) as UsersPayload["activities"]).filter(
      (item) => !supervisedOrganizationId || item.organization_id === supervisedOrganizationId,
    ),
    statusHistory: ((statusHistory.data ?? []) as UsersPayload["statusHistory"]).filter(
      (item) => !supervisedOrganizationId || item.organization_id === supervisedOrganizationId,
    ),
  } as UsersPayload;
}

export async function inviteUser(input: InviteUserInput) {
  await narrowToSupervisionScopeManager();
  await narrowToSupervisionScopeOrganization(input.organization_id);
  const supabase = await createClient();
  const token = randomBytes(32).toString("base64url");
  const { data, error } = await supabase
    .from("user_invitations")
    .insert({
      ...input,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    } as never)
    .select("id,organization_id,email,full_name,member_type,role_key,status,expires_at,created_at")
    .single();

  if (error) throw error;
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  const admin = createAdminClient();
  const authInvitation = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.full_name, organization_id: input.organization_id, role_key: input.role_key },
    redirectTo: origin ? `${origin}/auth/callback?next=/auth/update-password` : undefined,
  });
  if (authInvitation.error) {
    await supabase
      .from("user_invitations")
      .update({ status: "revoked", archived_at: new Date().toISOString() } as never)
      .eq("id", (data as { id: string }).id);
    throw authInvitation.error;
  }
  await recordSupervisionAction("USER_INVITED", "invitation", String((data as { id: string }).id), {
    organization_id: input.organization_id,
  });
  return { invitation: data };
}

export async function updateUser(input: UpdateUserInput) {
  await narrowToSupervisionScopeProfile(input.profile_id, input.organization_id);
  const supabase = await createClient();

  // narrowToSupervisionScopeProfile ne contrôle rien hors contexte de supervision (elle rend la
  // main immédiatement). C'est alors la RLS qui protège la donnée — mais un UPDATE bloqué
  // par la RLS ne lève AUCUNE erreur : il ne touche simplement aucune ligne. Sans le
  // `.select()` ci-dessous, l'application annonçait un succès sans rien avoir enregistré.
  if (input.full_name !== undefined || input.phone !== undefined) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: input.full_name, phone: input.phone } as never)
      .eq("id", input.profile_id)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      throw new Error("Modification refusee : cet utilisateur n est pas dans votre perimetre.");
    }
  }

  if (input.job_title !== undefined || input.city !== undefined) {
    const { error } = await supabase.from("user_profile_details").upsert(
      {
        profile_id: input.profile_id,
        organization_id: input.organization_id,
        job_title: input.job_title,
        city: input.city,
      } as never,
      { onConflict: "profile_id,organization_id" },
    );
    if (error) throw error;
  }

  // Même précaution : suspendre ou archiver quelqu'un hors de son périmètre ne doit pas
  // passer pour une réussite.
  if (input.status) {
    const { data, error } = await supabase
      .from("organization_members")
      .update({
        status: input.status === "inactive" ? "suspended" : input.status,
        archived_at: input.status === "archived" ? new Date().toISOString() : null,
      } as never)
      .eq("profile_id", input.profile_id)
      .eq("organization_id", input.organization_id)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      throw new Error("Changement de statut refuse : cet utilisateur n est pas dans votre perimetre.");
    }
  }

  await recordSupervisionAction("USER_UPDATED", "profile", input.profile_id, {
    organization_id: input.organization_id,
  });
  return listUsers();
}
