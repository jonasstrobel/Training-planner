"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const DISCIPLINE_COLORS: Record<string, string> = {
  SWIM: "bg-sky-100 text-sky-900 border-sky-300",
  BIKE: "bg-amber-100 text-amber-900 border-amber-300",
  RUN: "bg-emerald-100 text-emerald-900 border-emerald-300",
  BRICK: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300",
  STRENGTH: "bg-slate-100 text-slate-900 border-slate-300",
  MOBILITY: "bg-teal-100 text-teal-900 border-teal-300",
  REST: "bg-slate-50 text-slate-500 border-slate-200"
};

type SessionCardProps = {
  session: {
    discipline: string;
    title: string;
    description: string | null;
    durationMin: number;
    intensityZone: string | null;
    targetDistanceKm: number | null;
  };
};

export function SessionCard({ session }: SessionCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "text-left rounded border px-1.5 py-1 text-[11px] leading-tight hover:shadow-sm transition",
          DISCIPLINE_COLORS[session.discipline] ?? DISCIPLINE_COLORS.REST
        )}
      >
        <div className="font-semibold">{session.discipline}</div>
        <div className="truncate">{session.title}</div>
        <div className="opacity-70">
          {session.durationMin}min{session.intensityZone ? ` · ${session.intensityZone}` : ""}
          {session.targetDistanceKm ? ` · ${session.targetDistanceKm.toFixed(1)}km` : ""}
        </div>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-sm mb-1">
              {session.discipline} · {session.title}
            </h3>
            <div className="text-xs text-slate-500 mb-3">
              {session.durationMin}min
              {session.intensityZone ? ` · ${session.intensityZone}` : ""}
              {session.targetDistanceKm
                ? ` · ${session.targetDistanceKm.toFixed(1)}km`
                : ""}
            </div>
            <p className="text-sm whitespace-pre-wrap">
              {session.description ?? "No additional notes."}
            </p>
            <div className="mt-4 text-right">
              <button
                className="rounded-md bg-slate-200 dark:bg-slate-700 px-3 py-1 text-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
