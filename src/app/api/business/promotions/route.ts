import { requireSuperAdminApi } from "@/lib/auth/api-guards";
import { createPromotionCode } from "@/services/business-service";

export async function POST(request: Request) {
  const authorization = await requireSuperAdminApi();
  if (!authorization.authorized) return authorization.response;
  try {
    const body = (await request.json()) as {
      code?: string;
      campaign?: string;
      discountType?: "percent" | "fixed" | "free_month";
      discountValue?: number;
      expiresAt?: string;
    };
    if (!body.code || !body.discountType || !body.discountValue)
      return Response.json({ message: "Code promotionnel incomplet." }, { status: 400 });
    return Response.json(
      await createPromotionCode({
        code: body.code,
        campaign: body.campaign,
        discountType: body.discountType,
        discountValue: body.discountValue,
        expiresAt: body.expiresAt,
      }),
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Création impossible." }, { status: 400 });
  }
}
