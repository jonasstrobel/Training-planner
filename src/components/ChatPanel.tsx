"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type AskAthleteQuestion = {
  id: string;
  question: string;
  options?: string[];
  multiSelect?: boolean;
  freeText?: boolean;
};

type AskAthletePayload = {
  prompt?: string;
  questions?: AskAthleteQuestion[];
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

  const latestAskAthleteId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role === "USER") return null; // athlete already answered
      if (m.role !== "TOOL" || !m.toolResultJson) continue;
      try {
        const parsed = JSON.parse(m.toolResultJson);
        if (parsed.type === "ask_athlete") return m.id;
      } catch {
        /* ignore */
      }
    }
    return null;
  }, [messages]);

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
          <Bubble
            key={m.id}
            message={m}
            isLatestAsk={m.id === latestAskAthleteId}
            onSubmitAnswers={(text) => send.mutate(text)}
            isSubmitting={send.isPending}
          />
        ))}
        {send.isPending && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Coach is thinking…
          </div>
        )}
      </div>
      <form
        className="flex items-end gap-2 border-t border-slate-200 dark:border-slate-800 p-3 pb-5"
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
          placeholder="Message your coach…   (Enter to send, Shift+Enter for newline)"
          className="flex-1 resize-none rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
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

function Bubble({
  message,
  isLatestAsk,
  onSubmitAnswers,
  isSubmitting
}: {
  message: Message;
  isLatestAsk: boolean;
  onSubmitAnswers: (text: string) => void;
  isSubmitting: boolean;
}) {
  if (message.role === "TOOL") {
    return (
      <ToolBubble
        message={message}
        isLatestAsk={isLatestAsk}
        onSubmitAnswers={onSubmitAnswers}
        isSubmitting={isSubmitting}
      />
    );
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

function ToolBubble({
  message,
  isLatestAsk,
  onSubmitAnswers,
  isSubmitting
}: {
  message: Message;
  isLatestAsk: boolean;
  onSubmitAnswers: (text: string) => void;
  isSubmitting: boolean;
}) {
  let parsed: {
    type?: string;
    rationale?: string;
    message?: string;
    data?: AskAthletePayload;
  } = {};
  try {
    parsed = message.toolResultJson ? JSON.parse(message.toolResultJson) : {};
  } catch {
    /* ignore */
  }

  if (parsed.type === "ask_athlete" && parsed.data) {
    return (
      <AskAthleteBlock
        payload={parsed.data}
        interactive={isLatestAsk}
        onSubmit={onSubmitAnswers}
        isSubmitting={isSubmitting}
      />
    );
  }

  const label =
    parsed.type === "create_plan"
      ? "Created a new plan"
      : parsed.type === "replan_future"
        ? "Replanned future weeks"
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

function AskAthleteBlock({
  payload,
  interactive,
  onSubmit,
  isSubmitting
}: {
  payload: AskAthletePayload;
  interactive: boolean;
  onSubmit: (text: string) => void;
  isSubmitting: boolean;
}) {
  const questions = payload.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [freeText, setFreeText] = useState<Record<string, string>>({});

  const toggleOption = (q: AskAthleteQuestion, option: string) => {
    setAnswers((prev) => {
      const current = prev[q.id] ?? [];
      if (q.multiSelect) {
        return {
          ...prev,
          [q.id]: current.includes(option)
            ? current.filter((o) => o !== option)
            : [...current, option]
        };
      }
      return { ...prev, [q.id]: current[0] === option ? [] : [option] };
    });
  };

  const compile = () => {
    const lines: string[] = [];
    for (const q of questions) {
      const selected = answers[q.id] ?? [];
      const text = freeText[q.id]?.trim() ?? "";
      const parts: string[] = [];
      if (selected.length) parts.push(selected.join(", "));
      if (text) parts.push(text);
      if (parts.length) lines.push(`${q.question} — ${parts.join(" / ")}`);
    }
    return lines.join("\n");
  };

  const canSubmit =
    interactive &&
    !isSubmitting &&
    questions.some(
      (q) => (answers[q.id]?.length ?? 0) > 0 || (freeText[q.id]?.trim() ?? "") !== ""
    );

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-3">
      {payload.prompt && (
        <p className="text-sm text-slate-700 dark:text-slate-200">
          {payload.prompt}
        </p>
      )}
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.id} className="space-y-1">
            <div className="text-sm font-medium">{q.question}</div>
            {q.options && q.options.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {q.options.map((opt) => {
                  const selected = (answers[q.id] ?? []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={!interactive}
                      onClick={() => toggleOption(q, opt)}
                      className={cn(
                        "text-xs rounded-full border px-2 py-1 transition",
                        selected
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800",
                        !interactive && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
            {(q.freeText || !q.options || q.options.length === 0) && (
              <input
                type="text"
                value={freeText[q.id] ?? ""}
                onChange={(e) =>
                  setFreeText((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                disabled={!interactive}
                placeholder={q.options ? "Or type your own…" : "Your answer"}
                className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
              />
            )}
          </div>
        ))}
      </div>
      {interactive && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              const text = compile();
              if (!text) return;
              onSubmit(text);
            }}
            className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Send answers
          </button>
        </div>
      )}
      {!interactive && (
        <div className="text-[10px] text-slate-500 italic">
          (Answered — scroll down for the latest questions.)
        </div>
      )}
    </div>
  );
}
