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

### Connecting Garmin (paste-a-token)

The app never asks for your Garmin password. Instead, you copy the
OAuth bearer token your browser already has and paste it into the app:

1. Sign in to https://connect.garmin.com in your normal browser (MFA
   runs as usual).
2. Open DevTools → **Network** tab, filter for `connectapi`.
3. Reload the page and click any request in the list.
4. Under **Headers → Request Headers**, copy the value that follows
   `Authorization: Bearer ` (a long `eyJ…` string).
5. In the app, click **Connect Garmin** in the top bar and paste the
   token.

From then on, **Import from Garmin** pulls your latest activities and
triggers a replan. Tokens are short-lived (~1 hour); if a sync fails
with "token rejected", re-paste a fresh one. Tokens are stored only in
your local SQLite DB.

### Uploading activities without Garmin credentials

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
