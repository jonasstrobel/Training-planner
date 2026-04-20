"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";

export function UploadActivitiesButton({
  planId,
  onComplete
}: {
  planId: string | null;
  onComplete: (versionId: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [summary, setSummary] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      if (!planId) throw new Error("Create a plan first");
      const form = new FormData();
      form.append("planId", planId);
      Array.from(files).forEach((f) => form.append("files", f));
      const res = await fetch("/api/activities/upload", {
        method: "POST",
        body: form
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload failed");
      }
      return res.json() as Promise<{
        imported: number;
        skipped: number;
        errors: string[];
        replan: { versionId: string; rationale: string } | null;
      }>;
    },
    onSuccess: (data) => {
      const parts: string[] = [];
      parts.push(`${data.imported} imported`);
      if (data.skipped) parts.push(`${data.skipped} duplicates skipped`);
      if (data.errors?.length) parts.push(`${data.errors.length} errors`);
      setSummary(parts.join(", "));
      if (data.replan?.versionId) onComplete(data.replan.versionId);
      qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["chat"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    }
  });

  return (
    <div className="flex items-center gap-2">
      {summary && <span className="text-xs text-slate-500">{summary}</span>}
      {upload.isError && (
        <span className="text-xs text-rose-600">
          {(upload.error as Error).message}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".fit"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) upload.mutate(files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={!planId || upload.isPending}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-slate-50"
        title="Upload one or more .fit files exported from Garmin Connect"
      >
        {upload.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Upload FIT files
      </button>
    </div>
  );
}
