import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ message: "Authentification requise." }, { status: 401 });
  const body = (await request.json()) as { communicationId?: string };
  if (!body.communicationId) return Response.json({ message: "Communication requise." }, { status: 400 });
  const visible = await supabase
    .from("admin_communications" as never)
    .select("id" as never)
    .eq("id" as never, body.communicationId as never)
    .eq("status" as never, "published" as never)
    .maybeSingle();
  if (visible.error || !visible.data) return Response.json({ message: "Communication inaccessible." }, { status: 403 });
  const result = await supabase
    .from("admin_communication_acknowledgements" as never)
    .upsert({ communication_id: body.communicationId, profile_id: auth.user.id } as never, {
      onConflict: "communication_id,profile_id",
    });
  if (result.error) return Response.json({ message: result.error.message }, { status: 400 });
  return Response.json({ acknowledged: true });
}
