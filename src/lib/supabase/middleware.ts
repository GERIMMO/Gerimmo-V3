import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "./types";

function getSupabaseMiddlewareConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const config = getSupabaseMiddlewareConfig();

  if (!config) {
    return response;
  }

  const { supabaseUrl, supabaseAnonKey } = config;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({
          request,
        });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;

  const isProtectedApplicationPath = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (!isAuthenticated && isProtectedApplicationPath) {
    const loginUrl = new URL("/auth/v2/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isAuthenticated &&
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/dashboard/abonnement") &&
    !pathname.startsWith("/dashboard/onboarding")
  ) {
    const userId = String(data?.claims?.sub);
    const profile = await supabase.from("profiles").select("is_super_admin").eq("id", userId).maybeSingle();
    if (profile.data?.is_super_admin) return response;
    const membership = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("profile_id", userId)
      .eq("status", "active")
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (membership.data?.organization_id) {
      const subscription = await supabase
        .from("organization_subscriptions" as never)
        .select("status")
        .eq("organization_id", membership.data.organization_id)
        .maybeSingle();
      const status = (subscription.data as { status?: string } | null)?.status;
      if (status && ["suspended", "expired", "cancelled"].includes(status)) {
        return NextResponse.redirect(new URL("/dashboard/abonnement", request.url));
      }
    }
  }

  const isPublicWebhook =
    pathname === "/api/bot/telegram/webhook" ||
    pathname === "/api/stripe/webhook" ||
    pathname === "/api/automations/business" ||
    pathname === "/api/cron/production-health";
  const isPublicCommercial = pathname === "/api/commercial";
  if (!isAuthenticated && pathname.startsWith("/api/") && !isPublicWebhook && !isPublicCommercial) {
    return NextResponse.json({ message: "Authentification requise." }, { status: 401 });
  }

  return response;
}
