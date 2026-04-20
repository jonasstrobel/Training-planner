import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AskAthleteSchema,
  PlanSchema,
  ReplanResultSchema,
  type PlanInput,
  type ReplanResult,
  type WeekInput
} from "@/lib/schemas";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "ask_athlete",
    description:
      "Ask the athlete clarifying intake or follow-up questions before making a plan or replanning. Use for race target, fitness, availability, preferences.",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Short explanation shown before the questions."
        },
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              multiSelect: { type: "boolean" },
              freeText: { type: "boolean" }
            },
            required: ["id", "question"]
          }
        }
      },
      required: ["prompt", "questions"]
    }
  },
  {
    name: "create_plan",
    description:
      "Create a new multi-week triathlon training plan. Pass complete weeks with daily sessions. Writes PlanVersion 1.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        raceDistance: {
          type: "string",
          enum: ["SPRINT", "OLYMPIC", "HALF_IRONMAN", "IRONMAN"]
        },
        raceDateIso: { type: "string" },
        startDateIso: { type: "string" },
        goal: { type: "string" },
        weeks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              weekNumber: { type: "integer" },
              phase: {
                type: "string",
                enum: ["BASE", "BUILD", "PEAK", "TAPER", "RACE", "RECOVERY"]
              },
              focus: { type: "string" },
              sessions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dayOfWeek: { type: "integer", minimum: 0, maximum: 6 },
                    discipline: {
                      type: "string",
                      enum: [
                        "SWIM",
                        "BIKE",
                        "RUN",
                        "BRICK",
                        "STRENGTH",
                        "MOBILITY",
                        "REST"
                      ]
                    },
                    title: { type: "string" },
                    description: { type: "string" },
                    durationMin: { type: "integer" },
                    intensityZone: {
                      type: "string",
                      enum: ["Z1", "Z2", "Z3", "Z4", "Z5", "MIXED"]
                    },
                    targetDistanceKm: { type: "number" },
                    targetLoadTss: { type: "integer" }
                  },
                  required: ["dayOfWeek", "discipline", "title", "durationMin"]
                }
              }
            },
            required: ["weekNumber", "phase", "sessions"]
          }
        }
      },
      required: ["name", "raceDistance", "raceDateIso", "startDateIso", "weeks"]
    }
  },
  {
    name: "replan_future",
    description:
      "Rewrite the future weeks of the current plan in light of recent activities and athlete notes. Pass only the weeks to replace (weekNumber >= currentWeekNumber). A new PlanVersion is created.",
    input_schema: {
      type: "object",
      properties: {
        rationale: { type: "string" },
        weeks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              weekNumber: { type: "integer" },
              phase: {
                type: "string",
                enum: ["BASE", "BUILD", "PEAK", "TAPER", "RACE", "RECOVERY"]
              },
              focus: { type: "string" },
              sessions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dayOfWeek: { type: "integer", minimum: 0, maximum: 6 },
                    discipline: {
                      type: "string",
                      enum: [
                        "SWIM",
                        "BIKE",
                        "RUN",
                        "BRICK",
                        "STRENGTH",
                        "MOBILITY",
                        "REST"
                      ]
                    },
                    title: { type: "string" },
                    description: { type: "string" },
                    durationMin: { type: "integer" },
                    intensityZone: {
                      type: "string",
                      enum: ["Z1", "Z2", "Z3", "Z4", "Z5", "MIXED"]
                    },
                    targetDistanceKm: { type: "number" },
                    targetLoadTss: { type: "integer" }
                  },
                  required: ["dayOfWeek", "discipline", "title", "durationMin"]
                }
              }
            },
            required: ["weekNumber", "phase", "sessions"]
          }
        }
      },
      required: ["rationale", "weeks"]
    }
  }
];

export type ToolResult =
  | { type: "ask_athlete"; data: { prompt: string; questions: unknown[] } }
  | { type: "create_plan"; planId: string; versionId: string }
  | { type: "replan_future"; planId: string; versionId: string; rationale: string }
  | { type: "error"; message: string };

export async function executeTool(
  name: string,
  input: unknown,
  context: { planId?: string; baseVersionId?: string }
): Promise<ToolResult> {
  try {
    switch (name) {
      case "ask_athlete": {
        const parsed = AskAthleteSchema.parse(input);
        return { type: "ask_athlete", data: parsed };
      }
      case "create_plan": {
        const parsed = PlanSchema.parse(input);
        const { planId, versionId } = await writeNewPlan(parsed);
        return { type: "create_plan", planId, versionId };
      }
      case "replan_future": {
        if (!context.planId) {
          return { type: "error", message: "replan_future requires a planId" };
        }
        const parsed = ReplanResultSchema.parse(input);
        const { versionId } = await writeReplan(context.planId, parsed, {
          baseVersionId: context.baseVersionId
        });
        return {
          type: "replan_future",
          planId: context.planId,
          versionId,
          rationale: parsed.rationale
        };
      }
      default:
        return { type: "error", message: `Unknown tool ${name}` };
    }
  } catch (err) {
    const message = formatError(err);
    return { type: "error", message };
  }
}

function formatError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}

async function writeNewPlan(
  plan: PlanInput
): Promise<{ planId: string; versionId: string }> {
  const startDate = new Date(plan.startDateIso);
  return prisma.$transaction(async (tx) => {
    const created = await tx.plan.create({
      data: {
        name: plan.name,
        raceDistance: plan.raceDistance,
        raceDate: new Date(plan.raceDateIso),
        goal: plan.goal,
        startDate
      }
    });

    const version = await tx.planVersion.create({
      data: { planId: created.id, versionNumber: 1, rationale: null }
    });

    await writeWeeks(tx, version.id, plan.weeks, startDate);

    await tx.plan.update({
      where: { id: created.id },
      data: { currentVersionId: version.id }
    });

    return { planId: created.id, versionId: version.id };
  });
}

async function writeReplan(
  planId: string,
  replan: ReplanResult,
  opts: { baseVersionId?: string } = {}
): Promise<{ versionId: string }> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUniqueOrThrow({
      where: { id: planId },
      include: {
        currentVersion: { include: { weeks: { include: { sessions: true } } } }
      }
    });
    const baseId = opts.baseVersionId ?? plan.currentVersionId;
    if (!baseId) {
      throw new Error("Plan has no base version to fork from");
    }
    const base = await tx.planVersion.findUnique({
      where: { id: baseId },
      include: { weeks: { include: { sessions: true } } }
    });
    if (!base) {
      throw new Error(`Base version ${baseId} not found`);
    }

    const firstReplanWeekNumber = Math.min(...replan.weeks.map((w) => w.weekNumber));

    const last = await tx.planVersion.findFirst({
      where: { planId },
      orderBy: { versionNumber: "desc" }
    });
    const nextVersionNumber = (last?.versionNumber ?? 0) + 1;

    const newVersion = await tx.planVersion.create({
      data: {
        planId,
        versionNumber: nextVersionNumber,
        rationale: replan.rationale,
        parentVersionId: base.id
      }
    });

    // Carry forward past weeks unchanged (including their notes)
    const pastWeeks = base.weeks.filter(
      (w) => w.weekNumber < firstReplanWeekNumber
    );
    for (const w of pastWeeks) {
      const copied = await tx.week.create({
        data: {
          planVersionId: newVersion.id,
          weekNumber: w.weekNumber,
          startDate: w.startDate,
          phase: w.phase,
          focus: w.focus,
          notes: w.notes
        }
      });
      if (w.sessions.length > 0) {
        await tx.session.createMany({
          data: w.sessions.map((s) => ({
            weekId: copied.id,
            dayOfWeek: s.dayOfWeek,
            discipline: s.discipline,
            title: s.title,
            description: s.description,
            durationMin: s.durationMin,
            intensityZone: s.intensityZone,
            targetDistanceKm: s.targetDistanceKm,
            targetLoadTss: s.targetLoadTss
          }))
        });
      }
    }

    // Preserve notes from the base version when re-writing future weeks
    const oldNotesByWeekNumber = new Map<number, string | null>();
    for (const w of base.weeks) {
      oldNotesByWeekNumber.set(w.weekNumber, w.notes);
    }

    await writeWeeks(tx, newVersion.id, replan.weeks, plan.startDate, oldNotesByWeekNumber);

    await tx.plan.update({
      where: { id: planId },
      data: { currentVersionId: newVersion.id }
    });

    return { versionId: newVersion.id };
  });
}

async function writeWeeks(
  tx: Prisma.TransactionClient,
  planVersionId: string,
  weeks: WeekInput[],
  planStartDate: Date,
  carriedNotes?: Map<number, string | null>
) {
  const msPerDay = 24 * 60 * 60 * 1000;
  for (const w of weeks) {
    const weekStart = new Date(
      planStartDate.getTime() + (w.weekNumber - 1) * 7 * msPerDay
    );
    const createdWeek = await tx.week.create({
      data: {
        planVersionId,
        weekNumber: w.weekNumber,
        startDate: weekStart,
        phase: w.phase,
        focus: w.focus,
        notes: carriedNotes?.get(w.weekNumber) ?? null
      }
    });
    if (w.sessions.length > 0) {
      await tx.session.createMany({
        data: w.sessions.map((s) => ({
          weekId: createdWeek.id,
          dayOfWeek: s.dayOfWeek,
          discipline: s.discipline,
          title: s.title,
          description: s.description,
          durationMin: s.durationMin,
          intensityZone: s.intensityZone,
          targetDistanceKm: s.targetDistanceKm,
          targetLoadTss: s.targetLoadTss
        }))
      });
    }
  }
}

// Needed for the Prisma.TransactionClient type above
import type { Prisma } from "@prisma/client";
