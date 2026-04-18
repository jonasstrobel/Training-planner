import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/db";
import { COACH_SYSTEM_PROMPT, PLAN_CREATION_GUIDE } from "@/lib/prompts";
import { TOOLS, executeTool, type ToolResult } from "@/lib/planner";

export const runtime = "nodejs";

type IncomingBody = {
  planId?: string;
  message: string;
  mode?: "chat" | "replan";
  replanContext?: string;
};

const MAX_ITERATIONS = 6;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as IncomingBody;
  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const planId = body.planId;

  await prisma.chatMessage.create({
    data: { planId: planId ?? null, role: "USER", content: body.message }
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    const stubText =
      "Demo mode: no ANTHROPIC_API_KEY configured, so the coach can't reply. Set one in .env.local to enable real chat and plan generation.";
    await prisma.chatMessage.create({
      data: { planId: planId ?? null, role: "ASSISTANT", content: stubText }
    });
    return NextResponse.json({ text: stubText, toolResults: [], planId: planId ?? null });
  }

  const priorMessages = await prisma.chatMessage.findMany({
    where: { planId: planId ?? null },
    orderBy: { createdAt: "asc" }
  });

  const history: Anthropic.MessageParam[] = [];
  for (const m of priorMessages) {
    if (m.role === "USER") {
      history.push({ role: "user", content: m.content });
    } else if (m.role === "ASSISTANT") {
      // Assistant messages may have stored structured content (tool_use) but
      // for the loop we only need the visible text; tool results are replayed
      // through the live loop below, so we keep this simple.
      if (m.content) history.push({ role: "assistant", content: m.content });
    }
  }

  const extraSystem =
    body.mode === "replan" && body.replanContext
      ? `\n\nReplan context:\n${body.replanContext}`
      : "";

  const toolResults: ToolResult[] = [];
  let finalText = "";

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: COACH_SYSTEM_PROMPT + "\n\n" + PLAN_CREATION_GUIDE + extraSystem,
      tools: TOOLS,
      messages: history
    });

    const assistantBlocks = response.content;
    history.push({ role: "assistant", content: assistantBlocks });

    const textParts = assistantBlocks
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const toolUses = assistantBlocks.filter(
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
          planId: planId ?? (result.type === "create_plan" ? result.planId : null),
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

  const createdPlanId =
    toolResults.find((r) => r.type === "create_plan")?.type === "create_plan"
      ? (toolResults.find((r) => r.type === "create_plan") as {
          type: "create_plan";
          planId: string;
        }).planId
      : null;

  if (finalText) {
    await prisma.chatMessage.create({
      data: {
        planId: planId ?? createdPlanId ?? null,
        role: "ASSISTANT",
        content: finalText
      }
    });
  }

  return NextResponse.json({
    text: finalText,
    toolResults,
    planId: planId ?? createdPlanId
  });
}

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get("planId");
  const messages = await prisma.chatMessage.findMany({
    where: { planId: planId ?? null },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json({ messages });
}
