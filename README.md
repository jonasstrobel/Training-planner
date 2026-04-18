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
