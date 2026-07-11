import { createClient } from "@/lib/supabase/server";

export async function requireSuperAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false as const,
      response: Response.json({ message: "Authentification requise." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!profile?.is_super_admin) {
    return { authorized: false as const, response: Response.json({ message: "Acces interdit." }, { status: 403 }) };
  }

  return { authorized: true as const, user };
}
