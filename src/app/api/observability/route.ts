import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ message: "Authentification requise." }, { status: 401 });
  const body = (await request.json()) as {
    source?: string;
    eventType?: string;
    severity?: string;
    message?: string;
    screenPath?: string;
    apiPath?: string;
    durationMs?: number;
    statusCode?: number;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  };
  if (!body.source || !body.eventType || !body.message)
    return Response.json({ message: "Événement incomplet." }, { status: 400 });
  const membership = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  const inserted = await supabase
    .from("observability_events" as never)
    .insert({
      organization_id: membership.data?.organization_id ?? null,
      profile_id: auth.user.id,
      correlation_id: body.correlationId ?? randomUUID(),
      source: body.source,
      event_type: body.eventType,
      severity: body.severity ?? "error",
      message: body.message.slice(0, 2000),
      screen_path: body.screenPath ?? null,
      api_path: body.apiPath ?? null,
      duration_ms: body.durationMs ?? null,
      status_code: body.statusCode ?? null,
      metadata: body.metadata ?? {},
      fingerprint: `${body.source}:${body.eventType}:${body.apiPath ?? body.screenPath ?? "unknown"}`,
    } as never)
    .select("id,correlation_id")
    .single();
  if (inserted.error) return Response.json({ message: inserted.error.message }, { status: 400 });
  return Response.json(inserted.data, { status: 201 });
}
