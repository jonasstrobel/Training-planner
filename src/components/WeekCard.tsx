"use client";

import { SessionCard } from "@/components/SessionCard";
import { NotesField } from "@/components/NotesField";
import { cn } from "@/lib/cn";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PHASE_COLORS: Record<string, string> = {
  BASE: "bg-emerald-100 text-emerald-800",
  BUILD: "bg-amber-100 text-amber-800",
  PEAK: "bg-rose-100 text-rose-800",
  TAPER: "bg-sky-100 text-sky-800",
  RACE: "bg-indigo-100 text-indigo-800",
  RECOVERY: "bg-slate-100 text-slate-800"
};

type Session = {
  id: string;
  dayOfWeek: number;
  discipline: string;
  title: string;
  description: string | null;
  durationMin: number;
  intensityZone: string | null;
  targetDistanceKm: number | null;
};

type Activity = {
  id: string;
  startedAt: string;
  discipline: string;
  durationMin: number;
  distanceKm: number | null;
};

export function WeekCard({
  week,
  activities
}: {
  week: {
    id: string;
    weekNumber: number;
    startDate: string;
    phase: string;
    focus: string | null;
    notes: string | null;
    sessions: Session[];
  };
  activities: Activity[];
}) {
  const weekStart = new Date(week.startDate);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekActivities = activities.filter((a) => {
    const d = new Date(a.startedAt);
    return d >= weekStart && d < weekEnd;
  });

  const sessionsByDay = new Map<number, Session[]>();
  for (const s of week.sessions) {
    const list = sessionsByDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    sessionsByDay.set(s.dayOfWeek, list);
  }

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <header className="flex items-baseline justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">
            Week {week.weekNumber}
          </span>
          <span className="text-xs text-slate-500">
            {weekStart.toLocaleDateString()} –{" "}
            {new Date(weekEnd.getTime() - 1).toLocaleDateString()}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5",
              PHASE_COLORS[week.phase] ?? "bg-slate-100 text-slate-800"
            )}
          >
            {week.phase}
          </span>
        </div>
        {week.focus && (
          <span className="text-xs text-slate-500 max-w-[50%] truncate">
            {week.focus}
          </span>
        )}
      </header>
      <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800">
        {DAYS.map((label, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 p-2 min-h-[110px] flex flex-col gap-1"
          >
            <div className="text-[10px] font-semibold uppercase text-slate-500">
              {label}
            </div>
            {(sessionsByDay.get(idx) ?? []).map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        ))}
      </div>
      {weekActivities.length > 0 && (
        <div className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
          <span className="font-medium mr-2">Actuals:</span>
          {weekActivities.map((a) => (
            <span key={a.id} className="mr-3">
              {a.discipline} {a.durationMin}min
              {a.distanceKm ? ` / ${a.distanceKm.toFixed(1)}km` : ""}
            </span>
          ))}
        </div>
      )}
      <NotesField weekId={week.id} initialNotes={week.notes ?? ""} />
    </section>
  );
}
