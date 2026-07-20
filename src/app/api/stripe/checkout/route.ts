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
    // Stripe exige des URL de retour absolues. Se reposer sur le seul en-tête Origin est
    // fragile : il est absent de certains appels et le paiement échoue alors sur un
    // « Not a valid URL » incompréhensible. On retombe sur l'URL de la requête elle-même.
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    return Response.json(await createCheckout(body.organizationId, body.planId, data.user.email, origin));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Paiement indisponible." },
      { status: 400 },
    );
  }
}
