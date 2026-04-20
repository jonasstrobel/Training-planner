"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { GarminConnectDialog } from "@/components/GarminConnectDialog";

type Status = { connected: boolean; name?: string; sidecar?: string };

export function GarminConnectButton() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["garmin-status"],
    queryFn: async (): Promise<Status> => {
      const res = await fetch("/api/garmin/status");
      return res.json();
    }
  });

  const connected = Boolean(data?.connected);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-50"
        title={connected ? "Update or disconnect Garmin token" : "Paste a Garmin OAuth token"}
      >
        <KeyRound className="h-4 w-4" />
        Connect Garmin
        <span
          className={
            "inline-block h-2 w-2 rounded-full " +
            (connected ? "bg-emerald-500" : "bg-slate-300")
          }
          aria-label={connected ? "Connected" : "Not connected"}
        />
      </button>
      <GarminConnectDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
