import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { replanAfterActivities } from "@/lib/replan";

export const runtime = "nodejs";
export const maxDuration = 120;

type ParsedActivity = {
  startedAt: Date;
  discipline: "SWIM" | "BIKE" | "RUN" | "BRICK" | "STRENGTH" | "MOBILITY";
  durationMin: number;
  distanceKm: number | null;
  avgHr: number | null;
  maxHr: number | null;
  trainingLoad: number | null;
  externalId: string | null;
};

function mapSport(sport?: string, subSport?: string): ParsedActivity["discipline"] {
  const s = (sport ?? "").toLowerCase();
  const ss = (subSport ?? "").toLowerCase();
  if (s.includes("swim")) return "SWIM";
  if (s.includes("cycl") || s.includes("bike") || s.includes("ride")) return "BIKE";
  if (s.includes("run")) return "RUN";
  if (s === "multisport" || ss.includes("brick")) return "BRICK";
  if (s.includes("strength") || s.includes("training") || ss.includes("strength")) {
    return "STRENGTH";
  }
  if (ss.includes("yoga") || ss.includes("mobility") || ss.includes("stretch")) {
    return "MOBILITY";
  }
  return "RUN";
}

async function parseFitFile(buffer: Buffer): Promise<ParsedActivity | null> {
  const mod = await import("fit-file-parser");
  const FitParser = (mod as { default?: unknown; FitParser?: unknown }).default ??
    (mod as { FitParser?: unknown }).FitParser ??
    mod;
  const Ctor = FitParser as new (opts: unknown) => {
    parse: (
      buf: Buffer,
      cb: (err: string | null, data: unknown) => void
    ) => void;
  };
  const parser = new Ctor({
    force: true,
    speedUnit: "km/h",
    lengthUnit: "km",
    temperatureUnit: "celsius",
    elapsedRecordField: true,
    mode: "list"
  });

  return new Promise((resolve) => {
    parser.parse(buffer, (err: string | null, data: unknown) => {
      if (err) {
        console.error("FIT parse error:", err);
        resolve(null);
        return;
      }
      const d = data as {
        sessions?: Array<{
          sport?: string;
          sub_sport?: string;
          start_time?: string | Date;
          total_timer_time?: number;
          total_elapsed_time?: number;
          total_distance?: number;
          avg_heart_rate?: number;
          max_heart_rate?: number;
          total_training_effect?: number;
        }>;
        activity?: {
          local_timestamp?: string | Date;
          timestamp?: string | Date;
        };
        file_ids?: Array<{ serial_number?: number; time_created?: string | Date }>;
      };
      const session = d.sessions?.[0];
      if (!session) {
        resolve(null);
        return;
      }
      const start =
        session.start_time ??
        d.activity?.local_timestamp ??
        d.activity?.timestamp ??
        d.file_ids?.[0]?.time_created;
      if (!start) {
        resolve(null);
        return;
      }
      const durSec = session.total_timer_time ?? session.total_elapsed_time ?? 0;
      const serial = d.file_ids?.[0]?.serial_number;
      const timeCreated = d.file_ids?.[0]?.time_created;
      const externalId =
        serial && timeCreated
          ? `fit:${serial}:${new Date(timeCreated as string).getTime()}`
          : null;
      resolve({
        startedAt: new Date(start as string),
        discipline: mapSport(session.sport, session.sub_sport),
        durationMin: Math.max(0, Math.round(durSec / 60)),
        distanceKm:
          session.total_distance != null ? Number(session.total_distance) : null,
        avgHr: session.avg_heart_rate ?? null,
        maxHr: session.max_heart_rate ?? null,
        trainingLoad: session.total_training_effect ?? null,
        externalId
      });
    });
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const planId = form.get("planId");
  if (typeof planId !== "string" || !planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const fileEntries = form.getAll("files");
  const files = fileEntries.filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseFitFile(buffer);
      if (!parsed) {
        errors.push(`${file.name}: could not parse FIT file`);
        continue;
      }
      const existing = parsed.externalId
        ? await prisma.activity.findUnique({
            where: { garminActivityId: parsed.externalId }
          })
        : null;
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.activity.create({
        data: {
          planId,
          garminActivityId: parsed.externalId,
          source: "UPLOAD",
          startedAt: parsed.startedAt,
          discipline: parsed.discipline,
          durationMin: parsed.durationMin,
          distanceKm: parsed.distanceKm,
          avgHr: parsed.avgHr,
          maxHr: parsed.maxHr,
          trainingLoad: parsed.trainingLoad,
          rawJson: null
        }
      });
      imported += 1;
    } catch (err) {
      errors.push(
        `${file.name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (imported === 0) {
    return NextResponse.json({ imported, skipped, errors }, { status: 200 });
  }

  const shouldReplan = !!process.env.ANTHROPIC_API_KEY;
  let outcome: Awaited<ReturnType<typeof replanAfterActivities>> | null = null;
  if (shouldReplan) {
    outcome = await replanAfterActivities(planId, {
      kickoffMessage: `I just uploaded ${imported} FIT file${imported === 1 ? "" : "s"} from Garmin. Please review how the recent week(s) went vs the plan, then call replan_future to update this week onwards. Include a clear rationale.`
    });
  }

  return NextResponse.json({
    imported,
    skipped,
    errors,
    text: outcome?.text ?? null,
    replan: outcome?.replan ?? null
  });
}
