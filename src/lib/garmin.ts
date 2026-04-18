import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import type { Discipline } from "@/lib/schemas";

const SESSION_FILE = path.join(process.cwd(), ".garmin-session.json");

type RawActivity = {
  activityId: number | string;
  activityName?: string;
  startTimeLocal?: string;
  startTimeGMT?: string;
  activityType?: { typeKey?: string };
  duration?: number; // seconds
  distance?: number; // metres
  averageHR?: number;
  maxHR?: number;
  avgPower?: number;
  activityTrainingLoad?: number;
};

// Dynamic import to keep the heavy lib out of edge bundles
async function getClient() {
  const mod = await import("garmin-connect");
  const GCClient = (mod as { GarminConnect?: new (c: unknown) => unknown }).GarminConnect;
  if (!GCClient) throw new Error("garmin-connect module missing GarminConnect export");
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("GARMIN_EMAIL and GARMIN_PASSWORD must be set");
  }
  const client = new GCClient({ username: email, password }) as {
    login: (email?: string, password?: string) => Promise<void>;
    restore: (session: unknown) => Promise<boolean>;
    sessionJson: unknown;
    getActivities: (start: number, limit: number) => Promise<RawActivity[]>;
  };
  try {
    const cached = await fs.readFile(SESSION_FILE, "utf-8");
    await client.restore(JSON.parse(cached));
  } catch {
    await client.login(email, password);
    await fs.writeFile(SESSION_FILE, JSON.stringify(client.sessionJson), "utf-8");
  }
  return client;
}

function mapDiscipline(typeKey?: string): Discipline {
  const t = (typeKey ?? "").toLowerCase();
  if (t.includes("swim")) return "SWIM";
  if (t.includes("cycl") || t.includes("bike") || t.includes("ride")) return "BIKE";
  if (t.includes("run")) return "RUN";
  if (t.includes("brick") || t.includes("multi_sport")) return "BRICK";
  if (t.includes("strength") || t.includes("gym")) return "STRENGTH";
  if (t.includes("yoga") || t.includes("mobility") || t.includes("stretch"))
    return "MOBILITY";
  return "RUN"; // safest generic endurance default
}

export async function syncGarminActivities(planId: string) {
  const profile = await prisma.athleteProfile.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 }
  });

  const client = await getClient();
  const raw = await client.getActivities(0, 30);

  let imported = 0;
  const since = profile.lastGarminSyncAt?.getTime() ?? 0;
  for (const a of raw) {
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
