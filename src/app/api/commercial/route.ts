import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.website) return Response.json({ accepted: true });
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    const company = String(body.company ?? "").trim();
    const propertiesCount = Number(body.properties_count);
    const requestType = String(body.request_type ?? "contact");
    const consent = body.consent === "accepted";
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      fullName.length < 2 ||
      company.length < 2 ||
      propertiesCount < 1 ||
      !["demo", "appointment", "contact", "quote", "callback"].includes(requestType) ||
      !consent
    )
      return Response.json({ message: "Informations incomplètes ou invalides." }, { status: 400 });
    const admin = createAdminClient();
    const recent = await admin
      .from("commercial_leads")
      .select("id")
      .eq("email", email)
      .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .limit(1)
      .maybeSingle();
    if (recent.data) return Response.json({ message: "Votre demande a déjà été enregistrée." }, { status: 429 });
    const lead = await admin
      .from("commercial_leads")
      .insert({
        email,
        full_name: fullName.slice(0, 150),
        company: company.slice(0, 180),
        properties_count: propertiesCount,
        request_type: requestType,
        message: String(body.message ?? "").slice(0, 3000),
        source: "website",
        marketing_consent: true,
        consented_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (lead.error) throw lead.error;
    await admin.from("marketing_events").insert({
      lead_id: lead.data.id,
      event_type: "lead.created",
      source: "website",
      metadata: { request_type: requestType, properties_count: propertiesCount },
    });
    return Response.json({ accepted: true }, { status: 201 });
  } catch {
    return Response.json({ message: "La demande n’a pas pu être enregistrée." }, { status: 500 });
  }
}
