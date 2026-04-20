"use client";

import { useQuery } from "@tanstack/react-query";

type Version = {
  id: string;
  versionNumber: number;
  createdAt: string;
  parentVersionId: string | null;
};

type PlanResp = {
  plan:
    | {
        currentVersionId: string | null;
        versions: Version[];
      }
    | null;
};

export function VersionPicker({
  planId,
  activeVersionId,
  onChange
}: {
  planId: string;
  activeVersionId: string | null;
  onChange: (versionId: string | null) => void;
}) {
  const { data } = useQuery({
    queryKey: ["plan-versions", planId],
    queryFn: async (): Promise<PlanResp> => {
      const res = await fetch(`/api/plans/${planId}`);
      return res.json();
    }
  });

  const versions = data?.plan?.versions ?? [];
  if (versions.length === 0) return null;

  const currentId = activeVersionId ?? data?.plan?.currentVersionId ?? versions[0].id;
  const byId = new Map(versions.map((v) => [v.id, v]));

  return (
    <select
      value={currentId ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
      title="Which plan version to view and edit"
    >
      {versions.map((v) => {
        const parent = v.parentVersionId ? byId.get(v.parentVersionId) : null;
        const branch = parent ? ` ← v${parent.versionNumber}` : "";
        return (
          <option key={v.id} value={v.id}>
            v{v.versionNumber}{branch} · {new Date(v.createdAt).toLocaleDateString()}
          </option>
        );
      })}
    </select>
  );
}
