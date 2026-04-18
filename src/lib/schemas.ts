import { z } from "zod";

export const RaceDistance = z.enum([
  "SPRINT",
  "OLYMPIC",
  "HALF_IRONMAN",
  "IRONMAN"
]);
export type RaceDistance = z.infer<typeof RaceDistance>;

export const Discipline = z.enum([
  "SWIM",
  "BIKE",
  "RUN",
  "BRICK",
  "STRENGTH",
  "MOBILITY",
  "REST"
]);
export type Discipline = z.infer<typeof Discipline>;

export const IntensityZone = z.enum(["Z1", "Z2", "Z3", "Z4", "Z5", "MIXED"]);
export type IntensityZone = z.infer<typeof IntensityZone>;

export const Phase = z.enum([
  "BASE",
  "BUILD",
  "PEAK",
  "TAPER",
  "RACE",
  "RECOVERY"
]);
export type Phase = z.infer<typeof Phase>;

export const SessionSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  discipline: Discipline,
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  durationMin: z.number().int().min(0).max(600),
  intensityZone: IntensityZone.optional(),
  targetDistanceKm: z.number().nonnegative().optional(),
  targetLoadTss: z.number().int().nonnegative().optional()
});
export type SessionInput = z.infer<typeof SessionSchema>;

export const WeekSchema = z.object({
  weekNumber: z.number().int().min(1),
  phase: Phase,
  focus: z.string().max(280).optional(),
  sessions: z.array(SessionSchema).max(14)
});
export type WeekInput = z.infer<typeof WeekSchema>;

export const PlanSchema = z.object({
  name: z.string().min(1).max(120),
  raceDistance: RaceDistance,
  raceDateIso: z.string().datetime(),
  startDateIso: z.string().datetime(),
  goal: z.string().max(280).optional(),
  weeks: z.array(WeekSchema).min(1).max(52)
});
export type PlanInput = z.infer<typeof PlanSchema>;

export const ReplanResultSchema = z.object({
  rationale: z.string().min(1).max(4000),
  weeks: z.array(WeekSchema).min(1).max(52)
});
export type ReplanResult = z.infer<typeof ReplanResultSchema>;

export const AthleteProfileSchema = z.object({
  name: z.string().max(120).optional(),
  weeklyHoursAvailable: z.number().min(0).max(40).optional(),
  ftpWatts: z.number().int().min(0).max(600).optional(),
  runThresholdPaceSecPerKm: z.number().int().min(120).max(720).optional(),
  swimThresholdPaceSecPer100m: z.number().int().min(60).max(300).optional()
});
export type AthleteProfileInput = z.infer<typeof AthleteProfileSchema>;

export const AskAthleteSchema = z.object({
  prompt: z.string().min(1),
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        options: z.array(z.string()).optional(),
        multiSelect: z.boolean().optional(),
        freeText: z.boolean().optional()
      })
    )
    .min(1)
    .max(6)
});
export type AskAthlete = z.infer<typeof AskAthleteSchema>;
