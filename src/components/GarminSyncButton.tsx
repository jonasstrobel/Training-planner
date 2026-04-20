"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, KeyRound, LogOut } from "lucide-react";
import { GarminConnectDialog } from "@/components/GarminConnectDialog";

type Status = {
  connected: boolean;
  expiresAt?: string | null;
  expired?: boolean;
};

export function GarminSyncButton({
  planId,
  onComplete
}: {
  planId: string | null;
  onComplete: (versionId: string | null) => void;
}) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const status = useQuery({
    queryKey: ["garmin-status"],
    queryFn: async (): Promise<Status> => {
      const res = await fetch("/api/garmin/token");
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const error = new Error(err.error ?? "Sync failed") as Error & {
          code?: string;
        };
        error.code = err.code;
        throw error;
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
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === "TOKEN_INVALID" || err.code === "NOT_CONNECTED") {
        qc.invalidateQueries({ queryKey: ["garmin-status"] });
      }
    }
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await fetch("/api/garmin/token", { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garmin-status"] });
    }
  });

  const connected = status.data?.connected && !status.data.expired;

  return (
    <div className="flex items-center gap-2">
      {sync.isError && (
        <span className="text-xs text-rose-600 max-w-[40ch] truncate">
          {(sync.error as Error).message}
        </span>
      )}
      {connected ? (
        <>
          <button
            type="button"
            disabled={!planId || sync.isPending}
            onClick={() => sync.mutate()}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-slate-50"
            title="Fetch latest activities and replan future weeks"
          >
            {sync.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Import from Garmin
          </button>
          <button
            type="button"
            onClick={() => disconnect.mutate()}
            title="Disconnect Garmin (clears saved token)"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            <LogOut className="h-3 w-3" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          <KeyRound className="h-4 w-4" />
          Connect Garmin
        </button>
      )}
      <GarminConnectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
