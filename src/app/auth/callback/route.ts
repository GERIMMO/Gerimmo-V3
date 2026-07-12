import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = nextParam?.startsWith("/") ? nextParam : "/dashboard/accueil";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { error: activationError } = await supabase.rpc("accept_user_invitation");
      if (activationError && activationError.code !== "PGRST202") {
        return NextResponse.redirect(new URL("/auth/v2/login?error=activation-impossible", url.origin));
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/auth/v2/login?error=lien-invalide", url.origin));
}
