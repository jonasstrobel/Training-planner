"use client";

import { useQuery } from "@tanstack/react-query";

type PlanResp = {
  plan: { currentVersionId: string | null } | null;
  versionId: string | null;
};

type PlanWithVersions = PlanResp & {
  plan:
    | (PlanResp["plan"] & {
        versions: Array<{
          id: string;
          versionNumber: number;
          createdAt: string;
        }>;
      })
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
    queryFn: async (): Promise<PlanWithVersions> => {
      const res = await fetch(`/api/plans/${planId}`);
      return res.json();
    }
  });

  const versions = data?.plan?.versions ?? [];
  const currentId = activeVersionId ?? data?.plan?.currentVersionId ?? null;
  if (versions.length <= 1) return null;

  return (
    <select
      value={currentId ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          v{v.versionNumber} · {new Date(v.createdAt).toLocaleDateString()}
        </option>
      ))}
    </select>
  );
}
