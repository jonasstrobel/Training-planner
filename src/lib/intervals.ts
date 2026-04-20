import { prisma } from "@/lib/db";
import type { Discipline } from "@/lib/schemas";

const API_BASE = "https://intervals.icu/api/v1";

export class IntervalsAuthError extends Error {
  constructor(message = "intervals.icu API key rejected") {
    super(message);
    this.name = "IntervalsAuthError";
  }
}

function authHeader(apiKey: string): string {
  const token = Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  return `Basic ${token}`;
}

async function callIntervals<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json"
    },
    cache: "no-store"
  });
  if (res.status === 401 || res.status === 403) {
    throw new IntervalsAuthError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`intervals.icu ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function fetchAthleteId(apiKey: string): Promise<string> {
  const me = await callIntervals<{ id: number | string }>("/athlete/0", apiKey);
  return String(me.id);
}

type RawActivity = {
  id: string | number;
  start_date_local?: string;
  start_date?: string;
  type?: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  icu_average_watts?: number;
  average_watts?: number;
  icu_training_load?: number;
  training_load?: number;
  icu_ftp?: number;
  name?: string;
};

function mapDiscipline(type: string | undefined): Discipline {
  const t = (type ?? "").toLowerCase();
  if (t.includes("swim")) return "SWIM";
  if (
    t.includes("ride") ||
    t.includes("bike") ||
    t.includes("cycl") ||
    t.includes("virtualride")
  ) {
    return "BIKE";
  }
  if (t.includes("run") || t.includes("walk") || t.includes("hike")) return "RUN";
  if (t.includes("workout") || t.includes("weight") || t.includes("strength")) {
    return "STRENGTH";
  }
  if (t.includes("yoga") || t.includes("stretch")) return "MOBILITY";
  return "RUN";
}

export type IntervalsCredentialRecord = {
  id: number;
  apiKey: string;
  athleteId: string | null;
  lastSyncAt: Date | null;
};

async function loadCredential(): Promise<IntervalsCredentialRecord> {
  const cred = await prisma.intervalsCredential.findUnique({ where: { id: 1 } });
  if (!cred) throw new IntervalsAuthError("No intervals.icu API key saved");
  return cred;
}

export async function hasIntervalsCredential(): Promise<boolean> {
  const cred = await prisma.intervalsCredential.findUnique({ where: { id: 1 } });
  return Boolean(cred?.apiKey);
}

export async function syncIntervalsActivities(planId: string): Promise<{
  imported: number;
}> {
  const cred = await loadCredential();
  const athleteId = cred.athleteId ?? (await fetchAthleteId(cred.apiKey));
  if (!cred.athleteId) {
    await prisma.intervalsCredential.update({
      where: { id: 1 },
      data: { athleteId }
    });
  }

  // Pull last 180 days of activities on each sync; dedupe handles the rest.
  const oldestMs = (cred.lastSyncAt ?? new Date(Date.now() - 180 * 24 * 3600 * 1000)).getTime();
  const oldestIso = new Date(oldestMs).toISOString().slice(0, 10);
  const activities = await callIntervals<RawActivity[]>(
    `/athlete/${encodeURIComponent(athleteId)}/activities?oldest=${oldestIso}`,
    cred.apiKey
  );

  let imported = 0;
  for (const a of activities ?? []) {
    const startIso = a.start_date_local ?? a.start_date;
    if (!startIso) continue;
    const started = new Date(startIso);
    if (Number.isNaN(started.getTime())) continue;
    const externalId = `intervals:${a.id}`;

    const existing = await prisma.activity.findUnique({
      where: { garminActivityId: externalId }
    });
    if (existing) continue;

    const durationSec = a.moving_time ?? a.elapsed_time ?? 0;
    await prisma.activity.create({
      data: {
        garminActivityId: externalId,
        source: "INTERVALS",
        planId,
        startedAt: started,
        discipline: mapDiscipline(a.type),
        durationMin: Math.round(durationSec / 60),
        distanceKm: a.distance != null ? a.distance / 1000 : null,
        avgHr: a.average_heartrate ?? null,
        maxHr: a.max_heartrate ?? null,
        avgPowerWatts: a.icu_average_watts ?? a.average_watts ?? null,
        trainingLoad: a.icu_training_load ?? a.training_load ?? null,
        rawJson: JSON.stringify(a)
      }
    });
    imported += 1;
  }

  await prisma.intervalsCredential.update({
    where: { id: 1 },
    data: { lastSyncAt: new Date() }
  });

  return { imported };
}
