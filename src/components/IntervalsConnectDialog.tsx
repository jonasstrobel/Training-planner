"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Status = {
  connected: boolean;
  athleteId?: string | null;
  lastSyncAt?: string | null;
};

export function IntervalsConnectDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");

  const status = useQuery({
    queryKey: ["intervals-status"],
    queryFn: async (): Promise<Status> => {
      const res = await fetch("/api/intervals/credential");
      return res.json();
    },
    enabled: open
  });

  const save = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch("/api/intervals/credential", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["intervals-status"] });
      onClose();
    }
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await fetch("/api/intervals/credential", { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intervals-status"] });
    }
  });

  if (!open) return null;
  const connected = Boolean(status.data?.connected);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-xl w-full p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Connect intervals.icu</h3>
          {status.data && (
            <span className="text-xs text-slate-500">
              {connected ? (
                <span className="text-emerald-600 font-medium">
                  connected · athlete {status.data.athleteId}
                </span>
              ) : (
                <span>not connected</span>
              )}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Paste your intervals.icu personal API key. The server uses it to
          fetch activities Garmin syncs into intervals.icu.
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Where do I find the API key?
          </summary>
          <ol className="list-decimal pl-5 space-y-1 mt-2 text-slate-700 dark:text-slate-300">
            <li>
              Sign in to{" "}
              <code>https://intervals.icu</code> in your browser.
            </li>
            <li>
              Click your avatar (top right) → <strong>Settings</strong> → the{" "}
              <strong>Developer</strong> section.
            </li>
            <li>
              Copy the <strong>API key</strong>. (Click <em>Generate</em> if
              there isn&apos;t one yet.)
            </li>
            <li>Paste it below and click Save.</li>
          </ol>
        </details>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Your intervals.icu API key"
          className="w-full text-sm font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          spellCheck={false}
          autoComplete="off"
        />
        {save.isError && (
          <p className="text-xs text-rose-600">{(save.error as Error).message}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            {connected && (
              <button
                type="button"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                className="text-sm text-slate-500 hover:text-rose-600 disabled:opacity-50"
              >
                {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!apiKey.trim() || save.isPending}
              onClick={() => save.mutate(apiKey.trim())}
              className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {save.isPending ? "Verifying…" : "Save key"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
