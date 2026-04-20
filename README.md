# Triathlon Training Planner

A single-user web app that helps you build and maintain a multi-week
triathlon training plan through a chat interface. Pull completed
activities from Garmin with one click and the planner rewrites the
remaining weeks, posting a rationale into the chat.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Anthropic Claude (`claude-sonnet-4-6`) via tool use
- Prisma + SQLite
- `garmin-connect` (with FIT/TCX/GPX upload fallback)

## Quick start

```bash
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY and Garmin credentials
npm install
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000 and answer the intake chat to create your
first plan.

### Connecting intervals.icu

The app pulls activity data from [intervals.icu](https://intervals.icu),
which syncs itself with Garmin (and most other sources) and exposes a
clean personal API — no Garmin login or MFA gymnastics on our side.

1. Sign in to intervals.icu and make sure Garmin is connected in your
   intervals.icu settings (**Settings → Connections**).
2. In intervals.icu: avatar (top right) → **Settings** → **Developer** →
   copy your **API key**.
3. In the app, click **Connect intervals.icu** in the top bar, paste
   the key, and Save. A green dot means we've verified the key.
4. Click **Sync intervals.icu** to pull recent activities and trigger
   a replan. New activities write to the local DB; re-syncs deduplicate
   by intervals.icu's activity id.

### Uploading activities without API access

If you can't use the Garmin password login (e.g. enforced 2FA):

1. In Garmin Connect, open an activity.
2. Click the gear icon and choose **Export Original** to download the
   `.fit` file. For bulk export, select multiple activities in the
   Activities list and use **Export**.
3. In the app, click **Upload FIT files** in the top bar and choose the
   file(s). The app parses them, stores the activities, and (if
   `ANTHROPIC_API_KEY` is set) triggers the same replan flow with a
   rationale posted to chat.

Uploaded activities are deduplicated by the FIT file's internal
identifier, so uploading the same file twice is safe.

### UI-only demo mode

To browse the UI without any credentials:

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed      # inserts an 8-week Olympic demo plan
npm run dev
```

The chat and Garmin sync endpoints return friendly "demo mode" messages
when `ANTHROPIC_API_KEY`, `GARMIN_EMAIL`, or `GARMIN_PASSWORD` are
missing, so nothing crashes.

## Architecture

See `/root/.claude/plans/i-want-to-create-typed-dijkstra.md` (the
approved plan file) for the full architecture: data model, Claude tool
surface, chat / replan flow, Garmin integration, and verification steps.

Key directories:

- `prisma/schema.prisma` — data model
- `src/lib/` — shared libraries (Prisma client, Anthropic client,
  Claude tool definitions, Garmin wrapper, zod schemas, prompts)
- `src/app/api/` — route handlers for chat, plans, weeks, garmin sync
- `src/components/` — chat panel, plan view, week/session cards, notes,
  garmin sync button, version picker
