"use client";

import { useEffect, useRef, useState } from "react";

export function NotesField({
  weekId,
  initialNotes
}: {
  weekId: string;
  initialNotes: string;
}) {
  const [value, setValue] = useState(initialNotes);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(initialNotes), [initialNotes, weekId]);

  useEffect(() => {
    if (value === initialNotes) return;
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(async () => {
      await fetch(`/api/weeks/${weekId}/notes`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: value })
      });
      setStatus("saved");
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, initialNotes, weekId]);

  return (
    <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-500">
          Notes for this week
        </label>
        <span className="text-[10px] text-slate-400">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="How did training go? Anything the coach should know?"
        className="w-full resize-none rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}
