import { NextRequest, NextResponse } from "next/server";
import { syncGarminActivities } from "@/lib/garmin";
import { replanAfterActivities } from "@/lib/replan";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { planId?: string };
  const planId = body.planId;
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  if (!process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD) {
    return NextResponse.json(
      {
        error:
          "Demo mode: GARMIN_EMAIL and GARMIN_PASSWORD are not set. Add them to .env.local to enable Garmin sync, or use the Upload button instead."
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

  const { imported } = await syncGarminActivities(planId);

  const outcome = await replanAfterActivities(planId, {
    kickoffMessage: `I just synced ${imported} new Garmin activities. Please review how the past week(s) went vs the plan, then call replan_future to update this week onwards. Include a clear rationale.`
  });

  return NextResponse.json({
    imported,
    text: outcome.text,
    replan: outcome.replan
  });
}
