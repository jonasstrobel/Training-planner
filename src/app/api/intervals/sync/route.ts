import { NextRequest, NextResponse } from "next/server";
import { hasIntervalsCredential, IntervalsAuthError, syncIntervalsActivities } from "@/lib/intervals";
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
  if (!(await hasIntervalsCredential())) {
    return NextResponse.json(
      {
        error: "No intervals.icu API key saved. Click Connect intervals.icu.",
        code: "NOT_CONNECTED"
      },
      { status: 400 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set, so the coach can't replan after sync." },
      { status: 400 }
    );
  }

  try {
    const { imported } = await syncIntervalsActivities(planId);
    const outcome = await replanAfterActivities(planId, {
      kickoffMessage: `I just synced ${imported} new activities from intervals.icu. Please review how the past week(s) went vs the plan, then call replan_future to update this week onwards. Include a clear rationale.`,
      baseVersionId: planVersionId
    });
    return NextResponse.json({
      imported,
      text: outcome.text,
      replan: outcome.replan
    });
  } catch (err) {
    if (err instanceof IntervalsAuthError) {
      return NextResponse.json(
        {
          error: "intervals.icu API key rejected. Reconnect with a fresh key.",
          code: "TOKEN_INVALID"
        },
        { status: 401 }
      );
    }
    throw err;
  }
}
