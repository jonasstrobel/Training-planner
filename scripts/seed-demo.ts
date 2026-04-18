import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DemoSession = {
  dayOfWeek: number;
  discipline:
    | "SWIM"
    | "BIKE"
    | "RUN"
    | "BRICK"
    | "STRENGTH"
    | "MOBILITY"
    | "REST";
  title: string;
  description?: string;
  durationMin: number;
  intensityZone?: "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | "MIXED";
  targetDistanceKm?: number;
};

type DemoWeek = {
  weekNumber: number;
  phase: "BASE" | "BUILD" | "PEAK" | "TAPER" | "RACE" | "RECOVERY";
  focus: string;
  sessions: DemoSession[];
  notes?: string;
};

const DEMO_WEEKS: DemoWeek[] = [
  {
    weekNumber: 1,
    phase: "BASE",
    focus: "Re-introduce routine. Aerobic base, easy volume.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "Technique set", durationMin: 45, intensityZone: "Z2", targetDistanceKm: 2.0 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Endurance spin", durationMin: 75, intensityZone: "Z2", targetDistanceKm: 30 },
      { dayOfWeek: 2, discipline: "RUN", title: "Easy run", durationMin: 45, intensityZone: "Z2", targetDistanceKm: 7 },
      { dayOfWeek: 3, discipline: "STRENGTH", title: "Full-body strength", durationMin: 45 },
      { dayOfWeek: 4, discipline: "REST", title: "Rest", durationMin: 0 },
      { dayOfWeek: 5, discipline: "BIKE", title: "Long ride Z2", durationMin: 120, intensityZone: "Z2", targetDistanceKm: 55 },
      { dayOfWeek: 6, discipline: "RUN", title: "Long run easy", durationMin: 60, intensityZone: "Z2", targetDistanceKm: 10 }
    ],
    notes: "Felt good coming back. Shoulder held up fine in the pool."
  },
  {
    weekNumber: 2,
    phase: "BASE",
    focus: "Nudge volume up. Add run form drills.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "CSS 6x100", durationMin: 50, intensityZone: "Z3", targetDistanceKm: 2.2 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Endurance w/ cadence", durationMin: 80, intensityZone: "Z2", targetDistanceKm: 32 },
      { dayOfWeek: 2, discipline: "RUN", title: "Easy + strides", durationMin: 50, intensityZone: "Z2", targetDistanceKm: 8 },
      { dayOfWeek: 3, discipline: "STRENGTH", title: "Lower body focus", durationMin: 50 },
      { dayOfWeek: 4, discipline: "MOBILITY", title: "Yoga / mobility", durationMin: 30 },
      { dayOfWeek: 5, discipline: "BIKE", title: "Long ride", durationMin: 135, intensityZone: "Z2", targetDistanceKm: 60 },
      { dayOfWeek: 6, discipline: "BRICK", title: "Bike 45' + Run 20'", description: "Easy transition run off the bike.", durationMin: 65, intensityZone: "Z2" }
    ]
  },
  {
    weekNumber: 3,
    phase: "BUILD",
    focus: "First tempo work. Keep swim technique-heavy.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "Pull + drills", durationMin: 55, intensityZone: "MIXED", targetDistanceKm: 2.4 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Sweet spot 3x10'", durationMin: 80, intensityZone: "Z3", targetDistanceKm: 30 },
      { dayOfWeek: 2, discipline: "RUN", title: "Tempo 3x8' @ Z3", durationMin: 55, intensityZone: "Z3", targetDistanceKm: 9 },
      { dayOfWeek: 3, discipline: "STRENGTH", title: "Full-body strength", durationMin: 45 },
      { dayOfWeek: 4, discipline: "REST", title: "Rest", durationMin: 0 },
      { dayOfWeek: 5, discipline: "BIKE", title: "Long ride + 3x6' Z3", durationMin: 150, intensityZone: "MIXED", targetDistanceKm: 65 },
      { dayOfWeek: 6, discipline: "RUN", title: "Long run w/ surges", durationMin: 75, intensityZone: "MIXED", targetDistanceKm: 12 }
    ]
  },
  {
    weekNumber: 4,
    phase: "BUILD",
    focus: "Recovery week. Hold frequency, drop volume ~25%.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "Easy technique", durationMin: 40, intensityZone: "Z2", targetDistanceKm: 1.8 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Easy spin", durationMin: 60, intensityZone: "Z2", targetDistanceKm: 22 },
      { dayOfWeek: 2, discipline: "RUN", title: "Easy run", durationMin: 40, intensityZone: "Z2", targetDistanceKm: 6 },
      { dayOfWeek: 3, discipline: "MOBILITY", title: "Yoga / mobility", durationMin: 30 },
      { dayOfWeek: 4, discipline: "REST", title: "Rest", durationMin: 0 },
      { dayOfWeek: 5, discipline: "BIKE", title: "Moderate ride", durationMin: 90, intensityZone: "Z2", targetDistanceKm: 38 },
      { dayOfWeek: 6, discipline: "RUN", title: "Easy long run", durationMin: 55, intensityZone: "Z2", targetDistanceKm: 9 }
    ]
  },
  {
    weekNumber: 5,
    phase: "BUILD",
    focus: "Extend long sessions. Introduce open-water if possible.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "Mixed set 10x100 CSS", durationMin: 60, intensityZone: "Z3", targetDistanceKm: 2.6 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Sweet spot 2x15'", durationMin: 80, intensityZone: "Z3", targetDistanceKm: 30 },
      { dayOfWeek: 2, discipline: "RUN", title: "Tempo 20' continuous", durationMin: 60, intensityZone: "Z3", targetDistanceKm: 10 },
      { dayOfWeek: 3, discipline: "STRENGTH", title: "Full-body strength", durationMin: 45 },
      { dayOfWeek: 4, discipline: "REST", title: "Rest", durationMin: 0 },
      { dayOfWeek: 5, discipline: "BRICK", title: "Bike 2h + Run 30'", description: "Ride Z2 then 30' easy transition run.", durationMin: 150, intensityZone: "Z2" },
      { dayOfWeek: 6, discipline: "RUN", title: "Long run Z2", durationMin: 85, intensityZone: "Z2", targetDistanceKm: 14 }
    ]
  },
  {
    weekNumber: 6,
    phase: "PEAK",
    focus: "Race pace exposure across all three disciplines.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "Race-pace 5x200", durationMin: 55, intensityZone: "Z4", targetDistanceKm: 2.2 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Threshold 2x20'", durationMin: 90, intensityZone: "Z4", targetDistanceKm: 35 },
      { dayOfWeek: 2, discipline: "RUN", title: "5x1k at race pace", durationMin: 55, intensityZone: "Z4", targetDistanceKm: 9 },
      { dayOfWeek: 3, discipline: "STRENGTH", title: "Light maintenance", durationMin: 30 },
      { dayOfWeek: 4, discipline: "REST", title: "Rest", durationMin: 0 },
      { dayOfWeek: 5, discipline: "BRICK", title: "Race-sim 90' bike + 20' run", durationMin: 110, intensityZone: "Z3" },
      { dayOfWeek: 6, discipline: "RUN", title: "Long run w/ last 20' Z3", durationMin: 80, intensityZone: "MIXED", targetDistanceKm: 13 }
    ]
  },
  {
    weekNumber: 7,
    phase: "TAPER",
    focus: "Freshen up. Keep intensity, cut volume.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "Short race-pace", durationMin: 40, intensityZone: "Z4", targetDistanceKm: 1.6 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Openers: 3x3' Z4", durationMin: 50, intensityZone: "MIXED", targetDistanceKm: 20 },
      { dayOfWeek: 2, discipline: "RUN", title: "Easy + 4 strides", durationMin: 35, intensityZone: "Z2", targetDistanceKm: 6 },
      { dayOfWeek: 3, discipline: "REST", title: "Rest", durationMin: 0 },
      { dayOfWeek: 4, discipline: "SWIM", title: "Feel swim", durationMin: 30, intensityZone: "Z2", targetDistanceKm: 1.2 },
      { dayOfWeek: 5, discipline: "BIKE", title: "Short opener + 2' Z4", durationMin: 45, intensityZone: "MIXED" },
      { dayOfWeek: 6, discipline: "RUN", title: "Easy shakeout", durationMin: 25, intensityZone: "Z2", targetDistanceKm: 4 }
    ]
  },
  {
    weekNumber: 8,
    phase: "RACE",
    focus: "Race week. Minimal volume, keep the body sharp.",
    sessions: [
      { dayOfWeek: 0, discipline: "SWIM", title: "Short feel swim", durationMin: 25, intensityZone: "Z2", targetDistanceKm: 1.0 },
      { dayOfWeek: 1, discipline: "BIKE", title: "Openers 20'", durationMin: 30, intensityZone: "MIXED" },
      { dayOfWeek: 2, discipline: "RUN", title: "Easy 20' + 3 strides", durationMin: 25, intensityZone: "Z2" },
      { dayOfWeek: 3, discipline: "REST", title: "Rest", durationMin: 0 },
      { dayOfWeek: 4, discipline: "MOBILITY", title: "Light mobility", durationMin: 20 },
      { dayOfWeek: 5, discipline: "BIKE", title: "Pre-race openers", durationMin: 20, intensityZone: "MIXED" },
      { dayOfWeek: 6, discipline: "RUN", title: "RACE DAY", description: "Execute pacing plan. Fuel every 45'.", durationMin: 180, intensityZone: "Z3" }
    ]
  }
];

async function main() {
  const existing = await prisma.plan.findFirst({ where: { name: "Demo Olympic 8-week" } });
  if (existing) {
    console.log(`Demo plan already exists (${existing.id}). Skipping.`);
    return;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const now = new Date();
  // Start this past Monday so "current week" lands inside the plan
  const day = now.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const startDate = new Date(now.getTime() - daysSinceMonday * msPerDay);
  startDate.setHours(0, 0, 0, 0);
  const raceDate = new Date(startDate.getTime() + (DEMO_WEEKS.length * 7 - 1) * msPerDay);

  await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        name: "Demo Olympic 8-week",
        raceDistance: "OLYMPIC",
        raceDate,
        goal: "Finish strong under 3h",
        startDate
      }
    });
    const version = await tx.planVersion.create({
      data: { planId: plan.id, versionNumber: 1, rationale: null }
    });

    for (const w of DEMO_WEEKS) {
      const weekStart = new Date(startDate.getTime() + (w.weekNumber - 1) * 7 * msPerDay);
      const created = await tx.week.create({
        data: {
          planVersionId: version.id,
          weekNumber: w.weekNumber,
          startDate: weekStart,
          phase: w.phase,
          focus: w.focus,
          notes: w.notes ?? null
        }
      });
      await tx.session.createMany({
        data: w.sessions.map((s) => ({
          weekId: created.id,
          dayOfWeek: s.dayOfWeek,
          discipline: s.discipline,
          title: s.title,
          description: s.description ?? null,
          durationMin: s.durationMin,
          intensityZone: s.intensityZone ?? null,
          targetDistanceKm: s.targetDistanceKm ?? null
        }))
      });
    }

    await tx.plan.update({
      where: { id: plan.id },
      data: { currentVersionId: version.id }
    });

    await tx.chatMessage.create({
      data: {
        planId: plan.id,
        role: "ASSISTANT",
        content:
          "Here is your demo plan — 8 weeks building toward an Olympic-distance race. Open a week to see each session, or click Import from Garmin to simulate a replan."
      }
    });

    console.log(`Seeded demo plan ${plan.id}.`);

    const existingActivity = await tx.activity.findFirst();
    if (!existingActivity) {
      const demoActivities = buildDemoActivities(now);
      await tx.activity.createMany({
        data: demoActivities.map((a) => ({
          planId: plan.id,
          garminActivityId: null,
          source: "UPLOAD",
          startedAt: a.startedAt,
          discipline: a.discipline,
          durationMin: a.durationMin,
          distanceKm: a.distanceKm,
          avgHr: a.avgHr ?? null,
          maxHr: null,
          avgPowerWatts: null,
          trainingLoad: null,
          rawJson: null
        }))
      });
      console.log(`Seeded ${demoActivities.length} demo activities.`);
    }
  });
}

type DemoActivity = {
  startedAt: Date;
  discipline: "SWIM" | "BIKE" | "RUN";
  durationMin: number;
  distanceKm: number;
  avgHr?: number;
};

function buildDemoActivities(now: Date): DemoActivity[] {
  const msPerDay = 24 * 60 * 60 * 1000;
  const template: Array<{
    dayOffset: number;
    discipline: DemoActivity["discipline"];
    durationMin: number;
    distanceKm: number;
    avgHr: number;
  }> = [
    { dayOffset: 0, discipline: "SWIM", durationMin: 40, distanceKm: 1.8, avgHr: 135 },
    { dayOffset: 1, discipline: "BIKE", durationMin: 75, distanceKm: 29, avgHr: 140 },
    { dayOffset: 2, discipline: "RUN", durationMin: 45, distanceKm: 7.5, avgHr: 148 },
    { dayOffset: 4, discipline: "SWIM", durationMin: 55, distanceKm: 2.4, avgHr: 140 },
    { dayOffset: 5, discipline: "BIKE", durationMin: 125, distanceKm: 52, avgHr: 138 },
    { dayOffset: 6, discipline: "RUN", durationMin: 70, distanceKm: 11.5, avgHr: 150 }
  ];

  const WEEKS_BACK = 14;
  const out: DemoActivity[] = [];

  for (let w = WEEKS_BACK; w >= 1; w -= 1) {
    const variance = 1 + (Math.sin(w * 1.3) * 0.1);
    for (const t of template) {
      // Occasionally skip a session for realism
      if ((w + t.dayOffset) % 9 === 0) continue;
      const started = new Date(
        now.getTime() - w * 7 * msPerDay + t.dayOffset * msPerDay
      );
      started.setHours(18, 0, 0, 0);
      out.push({
        startedAt: started,
        discipline: t.discipline,
        durationMin: Math.round(t.durationMin * variance),
        distanceKm: Math.round(t.distanceKm * variance * 10) / 10,
        avgHr: t.avgHr
      });
    }
  }

  return out;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
