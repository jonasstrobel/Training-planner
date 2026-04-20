import { NextRequest, NextResponse } from "next/server";
import { syncGarminActivities } from "@/lib/garmin";
import { SidecarAuthError, SidecarDownError } from "@/lib/garmin-sidecar";
import { replanAfterActivities } from "@/lib/replan";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    planId?: string;
    planVersionId?: string;
  };
  const planId = body.planId;
  const planVersionId = body.planVersionId;
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
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
      kickoffMessage: `I just synced ${imported} new Garmin activities. Please review how the past week(s) went vs the plan, then call replan_future to update this week onwards. Include a clear rationale.`,
      baseVersionId: planVersionId
    });
    return NextResponse.json({ imported, text: outcome.text, replan: outcome.replan });
  } catch (err) {
    if (err instanceof SidecarAuthError) {
      return NextResponse.json(
        {
          error:
            "Garmin session expired. Click Connect Garmin to sign in again.",
          code: "NOT_CONNECTED"
        },
        { status: 401 }
      );
    }
    if (err instanceof SidecarDownError) {
      return NextResponse.json(
        { error: err.message, code: "SIDECAR_DOWN" },
        { status: 503 }
      );
    }
    throw err;
  }
}
