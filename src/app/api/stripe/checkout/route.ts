import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "@/services/stripe-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { organizationId?: string; planId?: string };
    if (!body.organizationId || !body.planId) return Response.json({ message: "Offre incomplète." }, { status: 400 });
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) return Response.json({ message: "Authentification requise." }, { status: 401 });
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    return Response.json(await createCheckout(body.organizationId, body.planId, data.user.email, origin));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Paiement indisponible." },
      { status: 400 },
    );
  }
}
