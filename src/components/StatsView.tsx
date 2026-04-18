"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { cn } from "@/lib/cn";

type Horizon = "4w" | "12w" | "6m" | "1y";
type Bucket = { durationMin: number; distanceKm: number };

type StatsResponse = {
  horizon: Horizon;
  weeks: Array<{
    weekStartIso: string;
    swim: Bucket;
    bike: Bucket;
    run: Bucket;
  }>;
  totals: { swim: Bucket; bike: Bucket; run: Bucket };
};

const HORIZONS: Array<{ value: Horizon; label: string }> = [
  { value: "4w", label: "Last 4 weeks" },
  { value: "12w", label: "Last 12 weeks" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" }
];

const DISCIPLINE_COLORS: Record<"swim" | "bike" | "run", { time: string; distance: string; heading: string }> = {
  swim: { time: "#0284c7", distance: "#38bdf8", heading: "Swim" },
  bike: { time: "#d97706", distance: "#fbbf24", heading: "Bike" },
  run: { time: "#059669", distance: "#34d399", heading: "Run" }
};

export function StatsView() {
  const [horizon, setHorizon] = useState<Horizon>("12w");

  const { data, isLoading } = useQuery({
    queryKey: ["stats", horizon],
    queryFn: async (): Promise<StatsResponse> => {
      const res = await fetch(`/api/stats?horizon=${horizon}`);
      return res.json();
    }
  });

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {HORIZONS.map((h) => (
          <button
            key={h.value}
            onClick={() => setHorizon(h.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md border transition",
              horizon === h.value
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
            )}
          >
            {h.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading stats…</div>}

      {data && (
        <div className="space-y-4">
          <DisciplinePanel
            name="swim"
            total={data.totals.swim}
            weeks={data.weeks.map((w) => ({
              week: shortLabel(w.weekStartIso),
              durationMin: w.swim.durationMin,
              distanceKm: w.swim.distanceKm
            }))}
          />
          <DisciplinePanel
            name="bike"
            total={data.totals.bike}
            weeks={data.weeks.map((w) => ({
              week: shortLabel(w.weekStartIso),
              durationMin: w.bike.durationMin,
              distanceKm: w.bike.distanceKm
            }))}
          />
          <DisciplinePanel
            name="run"
            total={data.totals.run}
            weeks={data.weeks.map((w) => ({
              week: shortLabel(w.weekStartIso),
              durationMin: w.run.durationMin,
              distanceKm: w.run.distanceKm
            }))}
          />
        </div>
      )}
    </div>
  );
}

function DisciplinePanel({
  name,
  total,
  weeks
}: {
  name: "swim" | "bike" | "run";
  total: Bucket;
  weeks: Array<{ week: string; durationMin: number; distanceKm: number }>;
}) {
  const palette = DISCIPLINE_COLORS[name];
  const hasData = total.durationMin > 0 || total.distanceKm > 0;

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <header className="flex items-baseline justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">{palette.heading}</h3>
        <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span>
            <span className="font-semibold">{formatDuration(total.durationMin)}</span>{" "}
            total time
          </span>
          <span>
            <span className="font-semibold">{total.distanceKm.toFixed(1)} km</span>{" "}
            total distance
          </span>
        </div>
      </header>
      <div className="p-3">
        {hasData ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" fontSize={10} stroke="#64748b" />
                <YAxis
                  yAxisId="left"
                  fontSize={10}
                  stroke={palette.time}
                  label={{ value: "min", angle: -90, position: "insideLeft", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={10}
                  stroke={palette.distance}
                  label={{ value: "km", angle: 90, position: "insideRight", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name === "Time (min)") return [`${value} min`, name];
                    if (name === "Distance (km)") return [`${value} km`, name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="durationMin" name="Time (min)" fill={palette.time} />
                <Bar yAxisId="right" dataKey="distanceKm" name="Distance (km)" fill={palette.distance} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-xs text-slate-500">
            No {palette.heading.toLowerCase()} activities in this horizon.
          </div>
        )}
      </div>
    </section>
  );
}

function formatDuration(min: number) {
  if (min <= 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function shortLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
