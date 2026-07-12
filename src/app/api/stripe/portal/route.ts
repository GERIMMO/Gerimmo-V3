import { headers } from "next/headers";

import { createBillingPortal } from "@/services/stripe-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { organizationId?: string };
    if (!body.organizationId) return Response.json({ message: "Organisation requise." }, { status: 400 });
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
    const session = await createBillingPortal(body.organizationId, origin);
    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Portail indisponible." },
      { status: 400 },
    );
  }
}
