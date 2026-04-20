import { NextRequest, NextResponse } from "next/server";
import { GarminAuthError, hasGarminCredential, syncGarminActivities } from "@/lib/garmin";
import { replanAfterActivities } from "@/lib/replan";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { planId?: string };
  const planId = body.planId;
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  if (!(await hasGarminCredential())) {
    return NextResponse.json(
      {
        error:
          "No Garmin token saved. Click Connect Garmin to paste an OAuth bearer token.",
        code: "NOT_CONNECTED"
      },
      { status: 400 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Demo mode: ANTHROPIC_API_KEY is not set, so the coach can't replan after sync."
      },
      { status: 400 }
    );
  }

  try {
    const { imported } = await syncGarminActivities(planId);
    const outcome = await replanAfterActivities(planId, {
      kickoffMessage: `I just synced ${imported} new Garmin activities. Please review how the past week(s) went vs the plan, then call replan_future to update this week onwards. Include a clear rationale.`
    });
    return NextResponse.json({ imported, text: outcome.text, replan: outcome.replan });
  } catch (err) {
    if (err instanceof GarminAuthError) {
      return NextResponse.json(
        {
          error:
            "Garmin token rejected (likely expired). Click Connect Garmin to paste a fresh token.",
          code: "TOKEN_INVALID"
        },
        { status: 401 }
      );
    }
    throw err;
  }
}
