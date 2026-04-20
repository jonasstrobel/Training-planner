import { prisma } from "@/lib/db";
import { postSync, type SidecarActivity } from "@/lib/garmin-sidecar";
import type { Discipline } from "@/lib/schemas";

function mapDiscipline(typeKey?: string | null): Discipline {
  const t = (typeKey ?? "").toLowerCase();
  if (t.includes("swim")) return "SWIM";
  if (t.includes("cycl") || t.includes("bike") || t.includes("ride")) return "BIKE";
  if (t.includes("run")) return "RUN";
  if (t.includes("brick") || t.includes("multi_sport")) return "BRICK";
  if (t.includes("strength") || t.includes("gym")) return "STRENGTH";
  if (t.includes("yoga") || t.includes("mobility") || t.includes("stretch"))
    return "MOBILITY";
  return "RUN";
}

export async function syncGarminActivities(planId: string) {
  const profile = await prisma.athleteProfile.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  const since = profile.lastGarminSyncAt?.toISOString();
  const { activities } = await postSync({ sinceIso: since, limit: 30 });

  let imported = 0;
  for (const a of activities) {
    const started = new Date(a.startedAtIso);
    if (Number.isNaN(started.getTime())) continue;
    await upsertActivity(planId, a, started);
    imported += 1;
  }

  await prisma.athleteProfile.update({
    where: { id: 1 },
    data: { lastGarminSyncAt: new Date() }
  });

  return { imported };
}

async function upsertActivity(
  planId: string,
  a: SidecarActivity,
  started: Date
) {
  await prisma.activity.upsert({
    where: { garminActivityId: a.activityId },
    update: {},
    create: {
      garminActivityId: a.activityId,
      source: "GARMIN",
      planId,
      startedAt: started,
      discipline: mapDiscipline(a.activityType),
      durationMin: a.durationSec != null ? Math.round(a.durationSec / 60) : 0,
      distanceKm: a.distanceMeters != null ? a.distanceMeters / 1000 : null,
      avgHr: a.avgHr ?? null,
      maxHr: a.maxHr ?? null,
      avgPowerWatts: a.avgPowerWatts ?? null,
      trainingLoad: a.trainingLoad ?? null,
      rawJson: JSON.stringify(a.raw)
    }
  });
}
