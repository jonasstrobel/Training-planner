import { prisma } from "@/lib/db";
import type { Discipline } from "@/lib/schemas";

const CONNECT_API = "https://connectapi.garmin.com";

export class GarminAuthError extends Error {
  constructor(message = "Garmin token is missing or has expired") {
    super(message);
    this.name = "GarminAuthError";
  }
}

type RawActivity = {
  activityId: number | string;
  startTimeGMT?: string;
  startTimeLocal?: string;
  activityType?: { typeKey?: string };
  duration?: number; // seconds
  distance?: number; // metres
  averageHR?: number;
  maxHR?: number;
  avgPower?: number;
  activityTrainingLoad?: number;
};

function mapDiscipline(typeKey?: string): Discipline {
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

async function loadCredential() {
  const cred = await prisma.garminCredential.findUnique({ where: { id: 1 } });
  if (!cred) throw new GarminAuthError("No Garmin token saved");
  return cred;
}

async function clearCredential() {
  await prisma.garminCredential.deleteMany({ where: { id: 1 } }).catch(() => {});
}

async function connectGet<T>(path: string): Promise<T> {
  const cred = await loadCredential();
  const res = await fetch(`${CONNECT_API}${path}`, {
    headers: {
      Authorization: `${cred.tokenType} ${cred.accessToken}`,
      "nk": "NT",
      "x-app-ver": "5.7.2.1",
      Accept: "application/json"
    },
    cache: "no-store"
  });
  if (res.status === 401 || res.status === 403) {
    await clearCredential();
    throw new GarminAuthError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Garmin API ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function hasGarminCredential(): Promise<boolean> {
  const cred = await prisma.garminCredential.findUnique({ where: { id: 1 } });
  return Boolean(cred?.accessToken);
}

export async function syncGarminActivities(planId: string) {
  const profile = await prisma.athleteProfile.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  const raw = await connectGet<RawActivity[]>(
    "/activitylist-service/activities/search/activities?start=0&limit=30"
  );

  let imported = 0;
  const since = profile.lastGarminSyncAt?.getTime() ?? 0;
  for (const a of raw ?? []) {
    const startIso = a.startTimeGMT ?? a.startTimeLocal;
    if (!startIso) continue;
    const started = new Date(startIso.replace(" ", "T") + "Z");
    if (started.getTime() <= since) continue;

    const garminId = String(a.activityId);
    await prisma.activity.upsert({
      where: { garminActivityId: garminId },
      update: {},
      create: {
        garminActivityId: garminId,
        source: "GARMIN",
        planId,
        startedAt: started,
        discipline: mapDiscipline(a.activityType?.typeKey),
        durationMin: Math.round((a.duration ?? 0) / 60),
        distanceKm: a.distance != null ? a.distance / 1000 : null,
        avgHr: a.averageHR ?? null,
        maxHr: a.maxHR ?? null,
        avgPowerWatts: a.avgPower ?? null,
        trainingLoad: a.activityTrainingLoad ?? null,
        rawJson: JSON.stringify(a)
      }
    });
    imported += 1;
  }

  await prisma.athleteProfile.update({
    where: { id: 1 },
    data: { lastGarminSyncAt: new Date() }
  });

  return { imported };
}
