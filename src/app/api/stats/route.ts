import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  startOfISOWeek,
  subWeeks,
  subMonths,
  subYears,
  addWeeks,
  formatISO
} from "date-fns";

export const runtime = "nodejs";

type Horizon = "4w" | "12w" | "6m" | "1y";
type DisciplineKey = "swim" | "bike" | "run";

type Bucket = { durationMin: number; distanceKm: number };

function horizonStart(horizon: Horizon, now: Date): Date {
  switch (horizon) {
    case "4w":
      return startOfISOWeek(subWeeks(now, 3));
    case "12w":
      return startOfISOWeek(subWeeks(now, 11));
    case "6m":
      return startOfISOWeek(subMonths(now, 6));
    case "1y":
      return startOfISOWeek(subYears(now, 1));
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
  const valid: Horizon[] = ["4w", "12w", "6m", "1y"];
  const horizon: Horizon = valid.includes(horizonParam) ? horizonParam : "12w";

  const now = new Date();
  const rangeStart = horizonStart(horizon, now);
  const rangeEndWeek = startOfISOWeek(now);

  const activities = await prisma.activity.findMany({
    where: { startedAt: { gte: rangeStart } },
    orderBy: { startedAt: "asc" }
  });

  const weeks: Array<{
    weekStartIso: string;
    swim: Bucket;
    bike: Bucket;
    run: Bucket;
  }> = [];
  const byWeek = new Map<string, (typeof weeks)[number]>();

  for (
    let cursor = rangeStart;
    cursor <= rangeEndWeek;
    cursor = addWeeks(cursor, 1)
  ) {
    const key = formatISO(cursor, { representation: "date" });
    const entry = {
      weekStartIso: key,
      swim: { durationMin: 0, distanceKm: 0 },
      bike: { durationMin: 0, distanceKm: 0 },
      run: { durationMin: 0, distanceKm: 0 }
    };
    weeks.push(entry);
    byWeek.set(key, entry);
  }

  const totals: Record<DisciplineKey, Bucket> = {
    swim: { durationMin: 0, distanceKm: 0 },
    bike: { durationMin: 0, distanceKm: 0 },
    run: { durationMin: 0, distanceKm: 0 }
  };

  for (const a of activities) {
    const d = disciplineKey(a.discipline);
    if (!d) continue;
    const weekKey = formatISO(startOfISOWeek(a.startedAt), {
      representation: "date"
    });
    const bucket = byWeek.get(weekKey);
    if (!bucket) continue;
    bucket[d].durationMin += a.durationMin;
    bucket[d].distanceKm += a.distanceKm ?? 0;
    totals[d].durationMin += a.durationMin;
    totals[d].distanceKm += a.distanceKm ?? 0;
  }

  for (const t of Object.values(totals)) {
    t.distanceKm = Math.round(t.distanceKm * 10) / 10;
  }
  for (const w of weeks) {
    w.swim.distanceKm = Math.round(w.swim.distanceKm * 10) / 10;
    w.bike.distanceKm = Math.round(w.bike.distanceKm * 10) / 10;
    w.run.distanceKm = Math.round(w.run.distanceKm * 10) / 10;
  }

  return NextResponse.json({ horizon, weeks, totals });
}
