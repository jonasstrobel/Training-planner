import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAthleteId, IntervalsAuthError } from "@/lib/intervals";

export const runtime = "nodejs";

export async function GET() {
  const cred = await prisma.intervalsCredential.findUnique({ where: { id: 1 } });
  if (!cred) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    athleteId: cred.athleteId,
    lastSyncAt: cred.lastSyncAt,
    updatedAt: cred.updatedAt
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }
  try {
    const athleteId = await fetchAthleteId(apiKey);
    const saved = await prisma.intervalsCredential.upsert({
      where: { id: 1 },
      update: { apiKey, athleteId },
      create: { id: 1, apiKey, athleteId }
    });
    return NextResponse.json({
      connected: true,
      athleteId: saved.athleteId
    });
  } catch (err) {
    if (err instanceof IntervalsAuthError) {
      return NextResponse.json(
        { error: "API key rejected by intervals.icu" },
        { status: 401 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  await prisma.intervalsCredential.deleteMany({ where: { id: 1 } });
  return NextResponse.json({ connected: false });
}
