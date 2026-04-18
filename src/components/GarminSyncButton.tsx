"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

export function GarminSyncButton({
  planId,
  onComplete
}: {
  planId: string | null;
  onComplete: (versionId: string | null) => void;
}) {
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Create a plan first");
      const res = await fetch("/api/garmin/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Sync failed");
      }
      return res.json() as Promise<{
        imported: number;
        replan: { versionId: string; rationale: string } | null;
      }>;
    },
    onSuccess: (data) => {
      onComplete(data.replan?.versionId ?? null);
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["chat"] });
    }
  });

  return (
    <div className="flex items-center gap-2">
      {sync.isError && (
        <span className="text-xs text-rose-600">
          {(sync.error as Error).message}
        </span>
      )}
      <button
        type="button"
        disabled={!planId || sync.isPending}
        onClick={() => sync.mutate()}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-slate-50"
      >
        {sync.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Import from Garmin
      </button>
    </div>
  );
}
