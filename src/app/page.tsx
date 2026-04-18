"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatPanel } from "@/components/ChatPanel";
import { PlanView } from "@/components/PlanView";
import { GarminSyncButton } from "@/components/GarminSyncButton";
import { VersionPicker } from "@/components/VersionPicker";

type PlanSummary = {
  id: string;
  name: string;
  raceDistance: string;
  raceDate: string;
};

export default function HomePage() {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<{ plans: PlanSummary[] }> => {
      const res = await fetch("/api/plans");
      return res.json();
    }
  });

  useEffect(() => {
    if (!activePlanId && plansQuery.data?.plans?.length) {
      setActivePlanId(plansQuery.data.plans[0].id);
    }
  }, [activePlanId, plansQuery.data]);

  const activePlan = plansQuery.data?.plans.find((p) => p.id === activePlanId);

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-white dark:bg-slate-900">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">Triathlon Training Planner</h1>
          {activePlan && (
            <span className="text-sm text-slate-500">
              {activePlan.name} · {activePlan.raceDistance} ·{" "}
              {new Date(activePlan.raceDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activePlanId && (
            <VersionPicker
              planId={activePlanId}
              activeVersionId={activeVersionId}
              onChange={setActiveVersionId}
            />
          )}
          <GarminSyncButton
            planId={activePlanId}
            onComplete={(newVersionId) => setActiveVersionId(newVersionId)}
          />
        </div>
      </header>
      <main className="flex-1 min-h-0 grid grid-cols-[minmax(320px,30%)_1fr]">
        <ChatPanel
          planId={activePlanId}
          onPlanCreated={(planId) => {
            setActivePlanId(planId);
            plansQuery.refetch();
          }}
        />
        <PlanView planId={activePlanId} versionId={activeVersionId} />
      </main>
    </div>
  );
}
