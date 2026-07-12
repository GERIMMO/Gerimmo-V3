import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request) {
  const expected = process.env.N8N_BUSINESS_WEBHOOK_SECRET;
  return Boolean(expected && request.headers.get("x-gerimmo-automation-secret") === expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ message: "Accès refusé." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; eventId?: string };
  const admin = createAdminClient();
  if (body.action === "evaluate_lifecycle") {
    const { data, error } = await admin.rpc("evaluate_subscription_lifecycle");
    if (error) return Response.json({ message: error.message }, { status: 500 });
    return Response.json({ suspended: data });
  }
  if (body.action === "acknowledge" && body.eventId) {
    const { error } = await admin
      .from("automation_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", body.eventId);
    if (error) return Response.json({ message: error.message }, { status: 500 });
    return Response.json({ acknowledged: true });
  }
  const { data, error } = await admin
    .from("automation_events")
    .select("*")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("created_at")
    .limit(25);
  if (error) return Response.json({ message: error.message }, { status: 500 });
  return Response.json({ events: data });
}
