"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Status = {
  connected: boolean;
  name?: string;
  sidecar?: string;
  error?: string;
};

type LoginResult =
  | { status: "logged_in" }
  | { status: "mfa_required" }
  | { status: "error"; error: string; code?: string };

type Step = "login" | "mfa" | "done";

export function GarminConnectDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const status = useQuery({
    queryKey: ["garmin-status"],
    queryFn: async (): Promise<Status> => {
      const res = await fetch("/api/garmin/status");
      return res.json();
    },
    enabled: open
  });

  useEffect(() => {
    if (open) {
      setStep("login");
      setCode("");
    }
  }, [open]);

  const login = useMutation({
    mutationFn: async (): Promise<LoginResult> => {
      const res = await fetch("/api/garmin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.status === "logged_in") {
        setStep("done");
        setPassword("");
        qc.invalidateQueries({ queryKey: ["garmin-status"] });
      } else if (result.status === "mfa_required") {
        setStep("mfa");
      }
    }
  });

  const mfa = useMutation({
    mutationFn: async (): Promise<LoginResult> => {
      const res = await fetch("/api/garmin/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      return res.json();
    },
    onSuccess: (result) => {
      if (result.status === "logged_in") {
        setStep("done");
        setPassword("");
        setCode("");
        qc.invalidateQueries({ queryKey: ["garmin-status"] });
      }
    }
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await fetch("/api/garmin/logout", { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["garmin-status"] });
    }
  });

  if (!open) return null;

  const sidecarDown = status.data?.sidecar === "down";
  const loginError =
    login.data && login.data.status === "error" ? login.data.error : null;
  const mfaError = mfa.data && mfa.data.status === "error" ? mfa.data.error : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Connect Garmin</h3>
          {status.data && (
            <span className="text-xs text-slate-500">
              {status.data.connected ? (
                <span className="text-emerald-600 font-medium">
                  connected{status.data.name ? ` · ${status.data.name}` : ""}
                </span>
              ) : sidecarDown ? (
                <span className="text-rose-600 font-medium">sidecar offline</span>
              ) : (
                <span>not connected</span>
              )}
            </span>
          )}
        </div>

        {sidecarDown && (
          <div className="text-xs text-rose-600 border border-rose-200 bg-rose-50 dark:bg-rose-900/20 rounded p-2">
            The Python Garmin sidecar is not running. Start it in a second
            terminal:
            <pre className="mt-1 whitespace-pre-wrap">
              cd python-sidecar{"\n"}source .venv/bin/activate{"\n"}uvicorn app:app --port 7321
            </pre>
          </div>
        )}

        {step === "login" && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (email && password && !login.isPending) login.mutate();
            }}
          >
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter your Garmin Connect credentials. They&apos;re sent to the
              local Python sidecar only, which authenticates with Garmin and
              caches tokens locally.
            </p>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5"
            />
            {loginError && <p className="text-xs text-rose-600">{loginError}</p>}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div>
                {status.data?.connected && (
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
                  type="submit"
                  disabled={!email || !password || login.isPending}
                  className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {login.isPending ? "Signing in…" : "Sign in"}
                </button>
              </div>
            </div>
          </form>
        )}

        {step === "mfa" && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code && !mfa.isPending) mfa.mutate();
            }}
          >
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Garmin sent a six-digit verification code. Enter it below.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="123456"
              className="w-full text-center font-mono text-lg tracking-[0.3em] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2"
              autoFocus
            />
            {mfaError && <p className="text-xs text-rose-600">{mfaError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep("login")}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!code || mfa.isPending}
                className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {mfa.isPending ? "Verifying…" : "Verify"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Connected. You can close this dialog and click Sync Garmin when
              you want to pull new activities.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-brand-600 text-white px-3 py-1.5 text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
