"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "TOOL" | "SYSTEM";
  content: string;
  createdAt: string;
  toolResultJson: string | null;
};

export function ChatPanel({
  planId,
  onPlanCreated
}: {
  planId: string | null;
  onPlanCreated: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["chat", planId ?? "new"],
    queryFn: async (): Promise<{ messages: Message[] }> => {
      const qs = planId ? `?planId=${planId}` : "";
      const res = await fetch(`/api/chat${qs}`);
      return res.json();
    },
    refetchInterval: 3000
  });

  const send = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, message })
      });
      return res.json() as Promise<{
        text: string;
        planId: string | null;
        toolResults: Array<{ type: string; planId?: string; versionId?: string }>;
      }>;
    },
    onSuccess: (res) => {
      setInput("");
      if (res.planId && res.planId !== planId) onPlanCreated(res.planId);
      qc.invalidateQueries({ queryKey: ["chat"] });
      qc.invalidateQueries({ queryKey: ["plans"] });
      if (res.planId) qc.invalidateQueries({ queryKey: ["plan", res.planId] });
    }
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [data?.messages?.length]);

  const messages = data?.messages ?? [];

  return (
    <div className="flex flex-col h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !planId && (
          <div className="text-sm text-slate-500">
            Say hi and tell your coach about your race goal to get started
            (distance, date, current volume, and how many hours per week you
            can train).
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {send.isPending && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Coach is thinking…
          </div>
        )}
      </div>
      <form
        className="flex items-end gap-2 border-t border-slate-200 dark:border-slate-800 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || send.isPending) return;
          send.mutate(input.trim());
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Message your coach…"
          className="flex-1 resize-none rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (input.trim() && !send.isPending) send.mutate(input.trim());
            }
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || send.isPending}
          className="rounded-md bg-brand-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.role === "TOOL") {
    return <ToolBubble message={message} />;
  }
  const isUser = message.role === "USER";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          isUser
            ? "bg-brand-600 text-white"
            : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function ToolBubble({ message }: { message: Message }) {
  let parsed: { type?: string; rationale?: string; message?: string } = {};
  try {
    parsed = message.toolResultJson ? JSON.parse(message.toolResultJson) : {};
  } catch {
    /* ignore */
  }
  const label =
    parsed.type === "create_plan"
      ? "Created a new plan"
      : parsed.type === "replan_future"
        ? "Replanned future weeks"
        : parsed.type === "ask_athlete"
          ? "Asked clarifying questions"
          : parsed.type === "error"
            ? `Tool error: ${parsed.message ?? ""}`
            : message.content;
  return (
    <div className="text-xs text-slate-500 italic border-l-2 border-slate-300 dark:border-slate-700 pl-2">
      {label}
      {parsed.rationale ? (
        <div className="not-italic mt-1 text-slate-700 dark:text-slate-300">
          {parsed.rationale}
        </div>
      ) : null}
    </div>
  );
}
