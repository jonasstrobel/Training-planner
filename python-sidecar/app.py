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

app = FastAPI()

_client: Optional[Garmin] = None
_pending: Dict[str, Any] = {}


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


@app.post("/login")
def login(req: LoginRequest) -> Dict[str, Any]:
    global _client, _pending
    try:
        g = Garmin(
            email=req.email,
            password=req.password,
            is_cn=False,
            return_on_mfa=True,
        )
        result1, result2 = g.login()
    except GarminConnectAuthenticationError as exc:
        return {"status": "error", "error": f"Auth failed: {exc}"}
    except GarminConnectConnectionError as exc:
        return {"status": "error", "error": f"Garmin unreachable: {exc}"}
    except GarminConnectTooManyRequestsError as exc:
        return {"status": "error", "error": f"Rate limited: {exc}"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "error": str(exc)}

    if result1 == "needs_mfa":
        _pending["client"] = g
        _pending["client_state"] = result2
        return {"status": "mfa_required"}

    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    g.garth.dump(str(TOKEN_DIR))
    _client = g
    return {"status": "logged_in"}


@app.post("/mfa")
def mfa(req: MfaRequest) -> Dict[str, Any]:
    global _client, _pending
    g = _pending.get("client")
    client_state = _pending.get("client_state")
    if g is None or client_state is None:
        raise HTTPException(404, "No pending login")
    try:
        g.resume_login(client_state, req.code)
    except Exception as exc:  # noqa: BLE001
        _pending.clear()
        return {"status": "error", "error": f"MFA failed: {exc}"}
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    g.garth.dump(str(TOKEN_DIR))
    _client = g
    _pending.clear()
    return {"status": "logged_in"}


@app.post("/logout")
def logout() -> Dict[str, Any]:
    global _client, _pending
    _client = None
    _pending.clear()
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
        # If token got invalidated, surface as 401 so Node can reprompt
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
