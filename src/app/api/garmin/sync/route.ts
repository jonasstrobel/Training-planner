import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/db";
import { syncGarminActivities } from "@/lib/garmin";
import { COACH_SYSTEM_PROMPT } from "@/lib/prompts";
import { TOOLS, executeTool, type ToolResult } from "@/lib/planner";

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
          "Demo mode: GARMIN_EMAIL and GARMIN_PASSWORD are not set. Add them to .env.local to enable Garmin sync."
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

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      currentVersion: {
        include: { weeks: { include: { sessions: true } } }
      }
    }
  });
  if (!plan?.currentVersion) {
    return NextResponse.json({ error: "No current plan version" }, { status: 400 });
  }

  const now = new Date();
  const current = plan.currentVersion.weeks.find(
    (w) => w.startDate <= now && now < addDays(w.startDate, 7)
  );
  const currentWeekNumber = current?.weekNumber ?? 1;

  const activities = await prisma.activity.findMany({
    where: { planId },
    orderBy: { startedAt: "desc" },
    take: 30
  });

  const context = buildReplanContext(
    {
      name: plan.name,
      raceDate: plan.raceDate,
      raceDistance: plan.raceDistance,
      currentVersion: plan.currentVersion
    },
    currentWeekNumber,
    activities
  );

  const toolResults: ToolResult[] = [];
  const userKickoff = `I just synced ${imported} new Garmin activities. Please review how the past week(s) went vs the plan, then call replan_future to update week ${currentWeekNumber} onwards. Include a clear rationale.`;

  await prisma.chatMessage.create({
    data: { planId, role: "USER", content: userKickoff }
  });

  const history: Anthropic.MessageParam[] = [
    { role: "user", content: userKickoff + "\n\n" + context }
  ];

  let finalText = "";
  for (let i = 0; i < 6; i += 1) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: COACH_SYSTEM_PROMPT,
      tools: TOOLS,
      messages: history
    });
    history.push({ role: "assistant", content: response.content });

    const textParts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUses.length === 0) {
      finalText = textParts;
      break;
    }

    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input, { planId });
      toolResults.push(result);
      await prisma.chatMessage.create({
        data: {
          planId,
          role: "TOOL",
          content: `[${tu.name}]`,
          toolCallJson: JSON.stringify(tu.input),
          toolResultJson: JSON.stringify(result)
        }
      });
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result),
        is_error: result.type === "error"
      });
    }
    history.push({ role: "user", content: toolResultBlocks });
    if (response.stop_reason === "end_turn") {
      finalText = textParts;
      break;
    }
  }

  if (finalText) {
    await prisma.chatMessage.create({
      data: { planId, role: "ASSISTANT", content: finalText }
    });
  }

  const replanResult = toolResults.find((r) => r.type === "replan_future");

  return NextResponse.json({
    imported,
    text: finalText,
    replan:
      replanResult && replanResult.type === "replan_future"
        ? {
            versionId: replanResult.versionId,
            rationale: replanResult.rationale
          }
        : null
  });
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function buildReplanContext(
  plan: { name: string; raceDate: Date; raceDistance: string; currentVersion: { weeks: Array<{ weekNumber: number; phase: string; focus: string | null; sessions: Array<{ dayOfWeek: number; discipline: string; title: string; durationMin: number; intensityZone: string | null }>; notes: string | null }> } },
  currentWeekNumber: number,
  activities: Array<{ startedAt: Date; discipline: string; durationMin: number; distanceKm: number | null; avgHr: number | null; trainingLoad: number | null }>
) {
  const weeksOut: string[] = [];
  for (const w of plan.currentVersion.weeks) {
    const marker =
      w.weekNumber < currentWeekNumber
        ? "PAST"
        : w.weekNumber === currentWeekNumber
          ? "CURRENT"
          : "FUTURE";
    const sessionLines = w.sessions
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map(
        (s) =>
          `  D${s.dayOfWeek} ${s.discipline} ${s.durationMin}min ${s.intensityZone ?? ""} — ${s.title}`
      )
      .join("\n");
    const notes = w.notes ? `  notes: ${w.notes}` : "";
    weeksOut.push(
      `Week ${w.weekNumber} [${marker}] phase=${w.phase} focus=${w.focus ?? "-"}\n${sessionLines}${notes ? "\n" + notes : ""}`
    );
  }

  const activityLines = activities
    .slice(0, 15)
    .map(
      (a) =>
        `- ${a.startedAt.toISOString().slice(0, 10)} ${a.discipline} ${a.durationMin}min ${a.distanceKm?.toFixed(1) ?? "-"}km HR${a.avgHr ?? "-"} TL${a.trainingLoad ?? "-"}`
    )
    .join("\n");

  return `Plan: ${plan.name} (${plan.raceDistance}, race ${plan.raceDate.toISOString().slice(0, 10)})\nCurrent week number: ${currentWeekNumber}\n\nPlan weeks:\n${weeksOut.join("\n\n")}\n\nRecent activities (most recent first):\n${activityLines || "(none)"}\n\nWhen calling replan_future, only include weeks with weekNumber >= ${currentWeekNumber}.`;
}
