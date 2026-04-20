"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function GarminConnectDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const save = useMutation({
    mutationFn: async (rawToken: string) => {
      const res = await fetch("/api/garmin/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: rawToken })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save token");
      }
      return res.json();
    },
    onSuccess: () => {
      setToken("");
      qc.invalidateQueries({ queryKey: ["garmin-status"] });
      onClose();
    }
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-xl w-full p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Connect Garmin</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Paste your Garmin Connect OAuth bearer token below. Your browser
          already has one — we just need a copy so the server can call the
          Garmin API on your behalf. The token stays on your machine in the
          local SQLite database.
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            How to grab the token (60 seconds)
          </summary>
          <ol className="list-decimal pl-5 space-y-1 mt-2 text-slate-700 dark:text-slate-300">
            <li>
              Open <code>https://connect.garmin.com</code> in your regular
              browser and sign in (MFA runs as usual).
            </li>
            <li>Open DevTools → <strong>Network</strong> tab.</li>
            <li>Reload the page.</li>
            <li>
              In the filter, type <code>connectapi</code>.
            </li>
            <li>Click any request in the list.</li>
            <li>
              Under <strong>Headers → Request Headers</strong>, find{" "}
              <code>Authorization: Bearer eyJ…</code> and copy the value{" "}
              <em>after</em> the word <code>Bearer</code>.
            </li>
            <li>Paste it below and click Save.</li>
          </ol>
        </details>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={6}
          placeholder="eyJraWQiOi… or the full Authorization value"
          className="w-full resize-none rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          spellCheck={false}
        />
        {save.isError && (
          <p className="text-xs text-rose-600">{(save.error as Error).message}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!token.trim() || save.isPending}
            onClick={() => save.mutate(token.trim())}
            className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save token"}
          </button>
        </div>
      </div>
    </div>
  );
}
