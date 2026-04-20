"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatPanel } from "@/components/ChatPanel";
import { PlanView } from "@/components/PlanView";
import { StatsView } from "@/components/StatsView";
import { GarminSyncButton } from "@/components/GarminSyncButton";
import { VersionPicker } from "@/components/VersionPicker";
import { cn } from "@/lib/cn";

type PlanSummary = {
  id: string;
  name: string;
  raceDistance: string;
  raceDate: string;
};

type Tab = "plan" | "stats";

export default function HomePage() {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("plan");

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
          {activePlanId && tab === "plan" && (
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
        <div className="min-h-0 overflow-hidden">
          <ChatPanel
            planId={activePlanId}
            onPlanCreated={(planId) => {
              setActivePlanId(planId);
              plansQuery.refetch();
            }}
          />
        </div>
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <TabButton active={tab === "plan"} onClick={() => setTab("plan")}>
              Plan
            </TabButton>
            <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
              Stats
            </TabButton>
          </div>
          <div className="flex-1 min-h-0">
            {tab === "plan" ? (
              <PlanView planId={activePlanId} versionId={activeVersionId} />
            ) : (
              <StatsView />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
        active
          ? "border-brand-600 text-brand-700 dark:text-brand-100"
          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
      )}
    >
      {children}
    </button>
  );
}
