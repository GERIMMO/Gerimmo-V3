import { NextResponse } from "next/server";

import { decideSchedule, proposeScheduleSlots } from "@/services/incident-scheduling-service";

type RouteContext = {
  params: Promise<{ scheduleId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { scheduleId } = await context.params;
    const body = await request.json();

    if (body.action === "proposer_creneaux") {
      return NextResponse.json(
        await proposeScheduleSlots({
          schedule_request_id: scheduleId,
          organization_id: body.organization_id,
          proposed_by: body.proposed_by,
          artisan_comment: body.artisan_comment,
          slots: body.slots ?? [],
        }),
      );
    }

    return NextResponse.json(
      await decideSchedule({
        schedule_request_id: scheduleId,
        slot_id: body.slot_id,
        actor_profile_id: body.actor_profile_id,
        actor_role: body.actor_role,
        action: body.action,
        comment: body.comment,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Action impossible." },
      { status: 500 },
    );
  }
}
