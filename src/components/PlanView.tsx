"use client";

import { useQuery } from "@tanstack/react-query";
import { WeekCard } from "@/components/WeekCard";

type Week = {
  id: string;
  weekNumber: number;
  startDate: string;
  phase: string;
  focus: string | null;
  notes: string | null;
  sessions: Array<{
    id: string;
    dayOfWeek: number;
    discipline: string;
    title: string;
    description: string | null;
    durationMin: number;
    intensityZone: string | null;
    targetDistanceKm: number | null;
  }>;
};

type Activity = {
  id: string;
  startedAt: string;
  discipline: string;
  durationMin: number;
  distanceKm: number | null;
};

export function PlanView({
  planId,
  versionId
}: {
  planId: string | null;
  versionId: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["plan", planId, versionId],
    enabled: Boolean(planId),
    queryFn: async (): Promise<{ weeks: Week[]; activities: Activity[] }> => {
      const qs = versionId ? `?versionId=${versionId}` : "";
      const res = await fetch(`/api/plans/${planId}${qs}`);
      return res.json();
    }
  });

  if (!planId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 p-8 text-center">
        <div className="max-w-md">
          <p className="text-lg font-medium">No plan yet</p>
          <p className="text-sm mt-1">
            Chat with your coach on the left to build a multi-week triathlon
            plan. Once it&rsquo;s created you&rsquo;ll see every session here,
            weekday by weekday.
          </p>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return <div className="p-6 text-slate-500 text-sm">Loading plan…</div>;
  }
  const weeks = data?.weeks ?? [];
  const activities = data?.activities ?? [];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {weeks.length === 0 && (
        <div className="text-slate-500 text-sm">
          The coach is still preparing your plan.
        </div>
      )}
      {weeks.map((w) => (
        <WeekCard key={w.id} week={w} activities={activities} />
      ))}
    </div>
  );
}
