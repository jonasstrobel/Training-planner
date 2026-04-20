export const SIDECAR_URL =
  process.env.GARMIN_SIDECAR_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:7321";

export class SidecarDownError extends Error {
  constructor() {
    super(
      "The Garmin sidecar is not running. Start it with `uvicorn app:app --port 7321` in python-sidecar (see python-sidecar/README.md)."
    );
    this.name = "SidecarDownError";
  }
}

export class SidecarAuthError extends Error {
  constructor(message = "Garmin session expired; please reconnect.") {
    super(message);
    this.name = "SidecarAuthError";
  }
}

async function call<T>(
  path: string,
  init?: RequestInit & { swallowNotFound?: boolean }
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SIDECAR_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch (err) {
    throw new SidecarDownError();
  }
  if (res.status === 401) throw new SidecarAuthError();
  const text = await res.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }
  if (!res.ok) {
    const err = (payload as { error?: string; detail?: string } | undefined);
    throw new Error(err?.error ?? err?.detail ?? `Sidecar ${res.status}`);
  }
  return payload as T;
}

export type SidecarStatus = { connected: boolean; name?: string };
export type LoginResult =
  | { status: "logged_in" }
  | { status: "mfa_required" }
  | { status: "error"; error: string };

export function getStatus() {
  return call<SidecarStatus>("/status");
}

export function postLogin(email: string, password: string) {
  return call<LoginResult>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function postMfa(code: string) {
  return call<LoginResult>("/mfa", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export function postLogout() {
  return call<{ ok: boolean }>("/logout", { method: "POST" });
}

export type SidecarActivity = {
  activityId: string;
  startedAtIso: string;
  activityType: string | null;
  durationSec: number | null;
  distanceMeters: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPowerWatts: number | null;
  trainingLoad: number | null;
  raw: unknown;
};

export function postSync(opts: { sinceIso?: string; limit?: number }) {
  return call<{ activities: SidecarActivity[] }>("/sync", {
    method: "POST",
    body: JSON.stringify(opts)
  });
}
