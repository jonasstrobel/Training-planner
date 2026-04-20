"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { cn } from "@/lib/cn";

type Horizon = "4w" | "12w" | "6m" | "1y" | "3m3m";
type Mode = "actual" | "planned" | "both";

type Bucket = { durationMin: number; distanceKm: number };
type Overall = { durationMin: number };

type StatsResponse = {
  horizon: Horizon;
  weeks: Array<{
    weekStartIso: string;
    isFuture: boolean;
    actual: { swim: Bucket; bike: Bucket; run: Bucket; overall: Overall };
    planned: { swim: Bucket; bike: Bucket; run: Bucket; overall: Overall };
  }>;
  totals: {
    actual: { swim: Bucket; bike: Bucket; run: Bucket; overall: Overall };
    planned: { swim: Bucket; bike: Bucket; run: Bucket; overall: Overall };
  };
};

const HORIZONS: Array<{ value: Horizon; label: string }> = [
  { value: "4w", label: "Last 4 weeks" },
  { value: "12w", label: "Last 12 weeks" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
  { value: "3m3m", label: "Last 3 + next 3 mo" }
];

const MODES: Array<{ value: Mode; label: string }> = [
  { value: "actual", label: "Actual" },
  { value: "planned", label: "Planned" },
  { value: "both", label: "Both" }
];

const PALETTE: Record<
  "swim" | "bike" | "run" | "overall",
  { actual: string; planned: string; heading: string }
> = {
  swim: { actual: "#0284c7", planned: "#7dd3fc", heading: "Swim" },
  bike: { actual: "#d97706", planned: "#fcd34d", heading: "Bike" },
  run: { actual: "#059669", planned: "#86efac", heading: "Run" },
  overall: { actual: "#475569", planned: "#cbd5e1", heading: "Overall (all disciplines)" }
};

export function StatsView() {
  const [horizon, setHorizon] = useState<Horizon>("12w");
  const [mode, setMode] = useState<Mode>("actual");

  const { data, isLoading } = useQuery({
    queryKey: ["stats", horizon],
    queryFn: async (): Promise<StatsResponse> => {
      const res = await fetch(`/api/stats?horizon=${horizon}`);
      return res.json();
    }
  });

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedButtons<Horizon>
          options={HORIZONS}
          value={horizon}
          onChange={setHorizon}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Show:</span>
          <SegmentedButtons<Mode> options={MODES} value={mode} onChange={setMode} />
        </div>
      </div>

      {isLoading && <div className="text-sm text-slate-500">Loading stats…</div>}

      {data && (
        <div className="space-y-4">
          <OverallPanel data={data} mode={mode} />
          <DisciplinePanel
            name="swim"
            actualTotal={data.totals.actual.swim}
            plannedTotal={data.totals.planned.swim}
            mode={mode}
            weeks={data.weeks.map((w) => ({
              week: shortLabel(w.weekStartIso),
              isFuture: w.isFuture,
              actualMin: w.actual.swim.durationMin,
              actualKm: w.actual.swim.distanceKm,
              plannedMin: w.planned.swim.durationMin,
              plannedKm: w.planned.swim.distanceKm
            }))}
          />
          <DisciplinePanel
            name="bike"
            actualTotal={data.totals.actual.bike}
            plannedTotal={data.totals.planned.bike}
            mode={mode}
            weeks={data.weeks.map((w) => ({
              week: shortLabel(w.weekStartIso),
              isFuture: w.isFuture,
              actualMin: w.actual.bike.durationMin,
              actualKm: w.actual.bike.distanceKm,
              plannedMin: w.planned.bike.durationMin,
              plannedKm: w.planned.bike.distanceKm
            }))}
          />
          <DisciplinePanel
            name="run"
            actualTotal={data.totals.actual.run}
            plannedTotal={data.totals.planned.run}
            mode={mode}
            weeks={data.weeks.map((w) => ({
              week: shortLabel(w.weekStartIso),
              isFuture: w.isFuture,
              actualMin: w.actual.run.durationMin,
              actualKm: w.actual.run.distanceKm,
              plannedMin: w.planned.run.durationMin,
              plannedKm: w.planned.run.distanceKm
            }))}
          />
        </div>
      )}
    </div>
  );
}

function SegmentedButtons<T extends string>({
  options,
  value,
  onChange
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md border transition",
            value === o.value
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function OverallPanel({ data, mode }: { data: StatsResponse; mode: Mode }) {
  const rows = data.weeks.map((w) => ({
    week: shortLabel(w.weekStartIso),
    isFuture: w.isFuture,
    actualMin: w.actual.overall.durationMin,
    plannedMin: w.planned.overall.durationMin
  }));
  const anyActual = rows.some((r) => r.actualMin > 0);
  const anyPlanned = rows.some((r) => r.plannedMin > 0);
  const showActual = mode !== "planned" && anyActual;
  const showPlanned = mode !== "actual" && anyPlanned;
  const hasData = showActual || showPlanned;

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <header className="flex items-baseline justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">Overall (all disciplines)</h3>
        <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
          {mode !== "planned" && (
            <span>
              <span className="font-semibold">
                {formatDuration(data.totals.actual.overall.durationMin)}
              </span>{" "}
              actual
            </span>
          )}
          {mode !== "actual" && (
            <span>
              <span className="font-semibold">
                {formatDuration(data.totals.planned.overall.durationMin)}
              </span>{" "}
              planned
            </span>
          )}
        </div>
      </header>
      <div className="p-3">
        {hasData ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" fontSize={10} stroke="#64748b" />
                <YAxis fontSize={10} stroke="#64748b" label={{ value: "min", angle: -90, position: "insideLeft", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number, name: string) => [`${value} min`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {showActual && (
                  <Bar dataKey="actualMin" name="Actual (min)" fill={PALETTE.overall.actual}>
                    {rows.map((r, i) => (
                      <Cell key={i} opacity={r.isFuture ? 0.35 : 1} />
                    ))}
                  </Bar>
                )}
                {showPlanned && (
                  <Bar dataKey="plannedMin" name="Planned (min)" fill={PALETTE.overall.planned}>
                    {rows.map((r, i) => (
                      <Cell key={i} opacity={r.isFuture ? 0.9 : 0.6} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-xs text-slate-500">
            No data for this horizon.
          </div>
        )}
      </div>
    </section>
  );
}

function DisciplinePanel({
  name,
  actualTotal,
  plannedTotal,
  mode,
  weeks
}: {
  name: "swim" | "bike" | "run";
  actualTotal: Bucket;
  plannedTotal: Bucket;
  mode: Mode;
  weeks: Array<{
    week: string;
    isFuture: boolean;
    actualMin: number;
    actualKm: number;
    plannedMin: number;
    plannedKm: number;
  }>;
}) {
  const palette = PALETTE[name];
  const showActual = mode !== "planned";
  const showPlanned = mode !== "actual";
  const hasData =
    (showActual && (actualTotal.durationMin > 0 || actualTotal.distanceKm > 0)) ||
    (showPlanned && (plannedTotal.durationMin > 0 || plannedTotal.distanceKm > 0));

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <header className="flex items-baseline justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">{palette.heading}</h3>
        <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
          {showActual && (
            <span>
              <span className="font-semibold">{formatDuration(actualTotal.durationMin)}</span>{" "}
              actual / <span className="font-semibold">{actualTotal.distanceKm.toFixed(1)} km</span>
            </span>
          )}
          {showPlanned && (
            <span>
              <span className="font-semibold">{formatDuration(plannedTotal.durationMin)}</span>{" "}
              planned / <span className="font-semibold">{plannedTotal.distanceKm.toFixed(1)} km</span>
            </span>
          )}
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
                  stroke={palette.actual}
                  label={{ value: "min", angle: -90, position: "insideLeft", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={10}
                  stroke={palette.planned}
                  label={{ value: "km", angle: 90, position: "insideRight", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name.endsWith("min")) return [`${value} min`, name];
                    if (name.endsWith("km")) return [`${value} km`, name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {showActual && (
                  <>
                    <Bar
                      yAxisId="left"
                      dataKey="actualMin"
                      name="Actual min"
                      fill={palette.actual}
                    >
                      {weeks.map((r, i) => (
                        <Cell key={i} opacity={r.isFuture ? 0.35 : 1} />
                      ))}
                    </Bar>
                    <Bar
                      yAxisId="right"
                      dataKey="actualKm"
                      name="Actual km"
                      fill={palette.actual}
                      opacity={0.5}
                    />
                  </>
                )}
                {showPlanned && (
                  <>
                    <Bar
                      yAxisId="left"
                      dataKey="plannedMin"
                      name="Planned min"
                      fill={palette.planned}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="plannedKm"
                      name="Planned km"
                      fill={palette.planned}
                      opacity={0.5}
                    />
                  </>
                )}
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
