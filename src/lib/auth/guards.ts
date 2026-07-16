import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}

export async function requireUser(redirectTo = "/auth/v2/login") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(redirectTo);
  }

  return user;
}

export async function requireSuperAdminPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,is_super_admin")
    .eq("id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!profile?.is_super_admin) {
    redirect("/unauthorized");
  }

  return { user, profile };
}
