# Garmin sidecar

A small FastAPI service that uses
[`python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
to log into Garmin Connect (with MFA) and fetch activities. The Node
app talks to it over HTTP (default `http://127.0.0.1:7321`).

## Requirements

- Python 3.10 or newer
- `pip` + `venv`

## One-time setup

```bash
cd python-sidecar
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run (leave open in its own terminal)

```bash
cd python-sidecar
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 7321
```

Tokens are persisted to `./python-sidecar/garmin-tokens/`; on restart
the sidecar resumes the logged-in session automatically. Override the
location with `GARMIN_TOKEN_DIR=...`.

## Endpoints (called by the Node app)

- `GET  /status`  — is there an active session?
- `POST /login`   — `{ email, password }` → `{ status: "logged_in" | "mfa_required" | "error" }`
- `POST /mfa`     — `{ code }` → `{ status: "logged_in" | "error" }`
- `POST /logout`  — wipe the saved tokens
- `POST /sync`    — `{ sinceIso?, limit? }` → `{ activities: [...] }`
