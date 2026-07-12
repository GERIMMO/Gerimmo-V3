import { createClient } from "@/lib/supabase/server";
import { refreshRecommendations } from "@/services/administration-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
    return Response.json({ generated: await refreshRecommendations(body.organizationId) });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Calcul impossible." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; status?: "accepted" | "dismissed"; note?: string };
    if (!body.id || !body.status) return Response.json({ message: "Décision incomplète." }, { status: 400 });
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return Response.json({ message: "Authentification requise." }, { status: 401 });
    const { data, error } = await supabase
      .from("business_recommendations" as never)
      .update({
        status: body.status,
        decision_note: body.note ?? null,
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Décision impossible." }, { status: 400 });
  }
}
