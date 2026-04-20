"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

type Status = { connected: boolean; name?: string; sidecar?: string };

export function GarminSyncButton({
  planId,
  onComplete
}: {
  planId: string | null;
  onComplete: (versionId: string | null) => void;
}) {
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["garmin-status"],
    queryFn: async (): Promise<Status> => {
      const res = await fetch("/api/garmin/status");
      return res.json();
    }
  });

  const sync = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Create a plan first");
      const res = await fetch("/api/garmin/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(payload.error ?? "Sync failed") as Error & {
          code?: string;
        };
        error.code = payload.code;
        throw error;
      }
      return payload as {
        imported: number;
        replan: { versionId: string; rationale: string } | null;
      };
    },
    onSuccess: (data) => {
      onComplete(data.replan?.versionId ?? null);
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["chat"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === "TOKEN_INVALID" || err.code === "NOT_CONNECTED") {
        qc.invalidateQueries({ queryKey: ["garmin-status"] });
      }
    }
  });

  const connected = Boolean(status.data?.connected);
  const disabled = !planId || !connected || sync.isPending;

  return (
    <div className="flex items-center gap-2">
      {sync.isError && (
        <span
          className="text-xs text-rose-600 max-w-[50ch] truncate"
          title={(sync.error as Error).message}
        >
          {(sync.error as Error).message}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => sync.mutate()}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-slate-50"
        title={
          !connected
            ? "Connect Garmin first to enable sync"
            : "Fetch latest activities and replan future weeks"
        }
      >
        {sync.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Sync Garmin
      </button>
    </div>
  );
}
