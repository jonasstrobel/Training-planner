"""FastAPI sidecar that wraps the `garminconnect` library
(https://github.com/cyberjunky/python-garminconnect) so the Node app can
log into Garmin Connect with MFA and pull activities.

Run locally:
    cd python-sidecar
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app:app --host 127.0.0.1 --port 7321
"""

from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

TOKEN_DIR = Path(os.environ.get("GARMIN_TOKEN_DIR", "./garmin-tokens")).resolve()
MFA_WAIT_SECONDS = 180
SIGNAL_WAIT_SECONDS = 20
JOIN_AFTER_MFA_SECONDS = 60

app = FastAPI()

_client: Optional[Garmin] = None
_login_lock = threading.Lock()


class _LoginSession:
    """Holds the state for one in-flight Garmin login."""

    def __init__(self) -> None:
        self.thread: Optional[threading.Thread] = None
        self.mfa_needed = threading.Event()
        self.code_supplied = threading.Event()
        self.done = threading.Event()
        self.code: Optional[str] = None
        self.result: Dict[str, Any] = {"status": "pending"}
        self.client: Optional[Garmin] = None


_session: Optional[_LoginSession] = None


def _try_resume() -> bool:
    global _client
    if not TOKEN_DIR.exists():
        _client = None
        return False
    try:
        g = Garmin()
        g.login(str(TOKEN_DIR))
        _ = g.get_full_name()
        _client = g
        return True
    except Exception:
        _client = None
        return False


_try_resume()


class LoginRequest(BaseModel):
    email: str
    password: str


class MfaRequest(BaseModel):
    code: str


class SyncRequest(BaseModel):
    sinceIso: Optional[str] = None
    limit: int = 30


@app.get("/status")
def status() -> Dict[str, Any]:
    global _client
    if _client is None and not _try_resume():
        return {"connected": False}
    try:
        name = _client.get_full_name()
        return {"connected": True, "name": name}
    except Exception:
        _client = None
        return {"connected": False}


def _abandon_session(session: _LoginSession) -> None:
    """Release a stale login thread so a fresh /login can proceed."""
    if session.thread and session.thread.is_alive():
        session.code = None
        session.code_supplied.set()
    session.done.set()


def _run_login(session: _LoginSession, email: str, password: str) -> None:
    def prompt_mfa() -> str:
        session.mfa_needed.set()
        if not session.code_supplied.wait(timeout=MFA_WAIT_SECONDS):
            raise TimeoutError("MFA code was never supplied")
        code = session.code
        if not code:
            raise RuntimeError("MFA prompt cancelled")
        return code

    try:
        g = Garmin(
            email=email,
            password=password,
            is_cn=False,
            prompt_mfa=prompt_mfa,
        )
        TOKEN_DIR.mkdir(parents=True, exist_ok=True)
        g.login(str(TOKEN_DIR))
        _ = g.get_full_name()
        session.client = g
        session.result = {"status": "logged_in"}
    except GarminConnectAuthenticationError as exc:
        session.result = {"status": "error", "error": f"Auth failed: {exc}"}
    except GarminConnectTooManyRequestsError as exc:
        session.result = {
            "status": "error",
            "error": (
                "Garmin has rate-limited your IP. Wait 30-60 minutes before "
                "retrying; repeated attempts reset the timer."
            ),
        }
    except GarminConnectConnectionError as exc:
        session.result = {"status": "error", "error": f"Garmin unreachable: {exc}"}
    except TimeoutError as exc:
        session.result = {"status": "error", "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        session.result = {"status": "error", "error": str(exc)}
    finally:
        session.done.set()


@app.post("/login")
def login(req: LoginRequest) -> Dict[str, Any]:
    global _session
    with _login_lock:
        if _session is not None:
            _abandon_session(_session)
        session = _LoginSession()
        _session = session
        session.thread = threading.Thread(
            target=_run_login,
            args=(session, req.email, req.password),
            daemon=True,
        )
        session.thread.start()

    waited = 0.0
    tick = 0.1
    while waited < SIGNAL_WAIT_SECONDS:
        if session.done.is_set():
            break
        if session.mfa_needed.is_set():
            break
        time.sleep(tick)
        waited += tick

    if session.done.is_set():
        if session.result.get("status") == "logged_in":
            _promote(session)
            return {"status": "logged_in"}
        return session.result

    if session.mfa_needed.is_set():
        return {"status": "mfa_required"}

    return {
        "status": "error",
        "error": "Timed out waiting for Garmin login response.",
    }


@app.post("/mfa")
def mfa(req: MfaRequest) -> Dict[str, Any]:
    global _session
    session = _session
    if session is None or session.thread is None:
        raise HTTPException(404, "No pending login")
    if session.done.is_set() and session.result.get("status") != "logged_in":
        return session.result
    session.code = req.code.strip()
    session.code_supplied.set()
    if not session.done.wait(timeout=JOIN_AFTER_MFA_SECONDS):
        return {
            "status": "error",
            "error": "Garmin did not finish verifying within 60s.",
        }
    if session.result.get("status") == "logged_in":
        _promote(session)
        return {"status": "logged_in"}
    return session.result


def _promote(session: _LoginSession) -> None:
    """Install a completed login session as the active client."""
    global _client, _session
    if session.client is None:
        return
    _client = session.client
    _session = None


@app.post("/logout")
def logout() -> Dict[str, Any]:
    global _client, _session
    _client = None
    if _session is not None:
        _abandon_session(_session)
        _session = None
    try:
        if TOKEN_DIR.exists():
            for child in TOKEN_DIR.iterdir():
                if child.is_file():
                    child.unlink()
            TOKEN_DIR.rmdir()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    return {"ok": True}


def _parse_start(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace(" ", "T")
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


@app.post("/sync")
def sync(req: SyncRequest) -> Dict[str, Any]:
    global _client
    if _client is None and not _try_resume():
        raise HTTPException(401, "Not logged in")

    try:
        activities = _client.get_activities(0, req.limit)
    except Exception as exc:  # noqa: BLE001
        _client = None
        raise HTTPException(401, f"Garmin call failed: {exc}")

    since_dt = _parse_start(req.sinceIso) if req.sinceIso else None
    out = []
    for a in activities or []:
        started = _parse_start(a.get("startTimeGMT") or a.get("startTimeLocal"))
        if started is None:
            continue
        if since_dt is not None and started <= since_dt:
            continue
        out.append(
            {
                "activityId": str(a.get("activityId")),
                "startedAtIso": started.astimezone(timezone.utc).isoformat(),
                "activityType": (a.get("activityType") or {}).get("typeKey"),
                "durationSec": a.get("duration"),
                "distanceMeters": a.get("distance"),
                "avgHr": a.get("averageHR"),
                "maxHr": a.get("maxHR"),
                "avgPowerWatts": a.get("avgPower"),
                "trainingLoad": a.get("activityTrainingLoad"),
                "raw": a,
            }
        )
    return {"activities": out}
