import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  startOfISOWeek,
  subWeeks,
  subMonths,
  subYears,
  addWeeks,
  addMonths,
  formatISO
} from "date-fns";

export const runtime = "nodejs";

type Horizon = "4w" | "12w" | "6m" | "1y" | "3m3m";
type DisciplineKey = "swim" | "bike" | "run";

type Bucket = { durationMin: number; distanceKm: number };
type EmptyOverall = { durationMin: number };

function emptyBucket(): Bucket {
  return { durationMin: 0, distanceKm: 0 };
}

function horizonRange(horizon: Horizon, now: Date): { start: Date; end: Date } {
  const thisWeek = startOfISOWeek(now);
  switch (horizon) {
    case "4w":
      return { start: startOfISOWeek(subWeeks(now, 3)), end: thisWeek };
    case "12w":
      return { start: startOfISOWeek(subWeeks(now, 11)), end: thisWeek };
    case "6m":
      return { start: startOfISOWeek(subMonths(now, 6)), end: thisWeek };
    case "1y":
      return { start: startOfISOWeek(subYears(now, 1)), end: thisWeek };
    case "3m3m":
      return {
        start: startOfISOWeek(subMonths(now, 3)),
        end: startOfISOWeek(addMonths(now, 3))
      };
  }
}

function disciplineKey(d: string): DisciplineKey | null {
  if (d === "SWIM") return "swim";
  if (d === "BIKE") return "bike";
  if (d === "RUN") return "run";
  return null;
}

export async function GET(req: NextRequest) {
  const horizonParam = (req.nextUrl.searchParams.get("horizon") ?? "12w") as Horizon;
  const valid: Horizon[] = ["4w", "12w", "6m", "1y", "3m3m"];
  const horizon: Horizon = valid.includes(horizonParam) ? horizonParam : "12w";

  const now = new Date();
  const thisWeek = startOfISOWeek(now);
  const { start: rangeStart, end: rangeEndWeek } = horizonRange(horizon, now);

  // Build empty buckets for every week in the horizon
  type Week = {
    weekStartIso: string;
    isFuture: boolean;
    actual: {
      swim: Bucket;
      bike: Bucket;
      run: Bucket;
      overall: EmptyOverall;
    };
    planned: {
      swim: Bucket;
      bike: Bucket;
      run: Bucket;
      overall: EmptyOverall;
    };
  };

  const weeks: Week[] = [];
  const byWeekKey = new Map<string, Week>();
  for (
    let cursor = rangeStart;
    cursor <= rangeEndWeek;
    cursor = addWeeks(cursor, 1)
  ) {
    const key = formatISO(cursor, { representation: "date" });
    const entry: Week = {
      weekStartIso: key,
      isFuture: cursor > thisWeek,
      actual: {
        swim: emptyBucket(),
        bike: emptyBucket(),
        run: emptyBucket(),
        overall: { durationMin: 0 }
      },
      planned: {
        swim: emptyBucket(),
        bike: emptyBucket(),
        run: emptyBucket(),
        overall: { durationMin: 0 }
      }
    };
    weeks.push(entry);
    byWeekKey.set(key, entry);
  }

  // Actuals from activities (include all disciplines for overall)
  const activities = await prisma.activity.findMany({
    where: { startedAt: { gte: rangeStart } },
    orderBy: { startedAt: "asc" }
  });
  for (const a of activities) {
    const weekKey = formatISO(startOfISOWeek(a.startedAt), { representation: "date" });
    const bucket = byWeekKey.get(weekKey);
    if (!bucket) continue;
    bucket.actual.overall.durationMin += a.durationMin;
    const dk = disciplineKey(a.discipline);
    if (dk) {
      bucket.actual[dk].durationMin += a.durationMin;
      bucket.actual[dk].distanceKm += a.distanceKm ?? 0;
    }
  }

  // Planned from the current plan version's sessions
  const plans = await prisma.plan.findMany({
    select: {
      currentVersion: {
        select: {
          weeks: {
            select: {
              startDate: true,
              sessions: {
                select: {
                  discipline: true,
                  durationMin: true,
                  targetDistanceKm: true
                }
              }
            }
          }
        }
      }
    }
  });
  for (const plan of plans) {
    const cv = plan.currentVersion;
    if (!cv) continue;
    for (const w of cv.weeks) {
      const weekKey = formatISO(startOfISOWeek(w.startDate), {
        representation: "date"
      });
      const bucket = byWeekKey.get(weekKey);
      if (!bucket) continue;
      for (const s of w.sessions) {
        bucket.planned.overall.durationMin += s.durationMin;
        const dk = disciplineKey(s.discipline);
        if (dk) {
          bucket.planned[dk].durationMin += s.durationMin;
          bucket.planned[dk].distanceKm += s.targetDistanceKm ?? 0;
        }
      }
    }
  }

  // Round distances to 1 decimal
  for (const w of weeks) {
    for (const k of ["swim", "bike", "run"] as const) {
      w.actual[k].distanceKm = Math.round(w.actual[k].distanceKm * 10) / 10;
      w.planned[k].distanceKm = Math.round(w.planned[k].distanceKm * 10) / 10;
    }
  }

  // Totals per mode
  const totals = {
    actual: {
      swim: emptyBucket(),
      bike: emptyBucket(),
      run: emptyBucket(),
      overall: { durationMin: 0 }
    },
    planned: {
      swim: emptyBucket(),
      bike: emptyBucket(),
      run: emptyBucket(),
      overall: { durationMin: 0 }
    }
  };
  for (const w of weeks) {
    for (const k of ["swim", "bike", "run"] as const) {
      totals.actual[k].durationMin += w.actual[k].durationMin;
      totals.actual[k].distanceKm += w.actual[k].distanceKm;
      totals.planned[k].durationMin += w.planned[k].durationMin;
      totals.planned[k].distanceKm += w.planned[k].distanceKm;
    }
    totals.actual.overall.durationMin += w.actual.overall.durationMin;
    totals.planned.overall.durationMin += w.planned.overall.durationMin;
  }
  for (const k of ["swim", "bike", "run"] as const) {
    totals.actual[k].distanceKm = Math.round(totals.actual[k].distanceKm * 10) / 10;
    totals.planned[k].distanceKm = Math.round(totals.planned[k].distanceKm * 10) / 10;
  }

  return NextResponse.json({ horizon, weeks, totals });
}
