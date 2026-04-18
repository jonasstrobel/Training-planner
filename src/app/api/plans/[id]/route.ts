import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const versionIdParam = req.nextUrl.searchParams.get("versionId");

  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true, createdAt: true, rationale: true }
      },
      currentVersion: true
    }
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const targetVersionId = versionIdParam ?? plan.currentVersionId;
  if (!targetVersionId) {
    return NextResponse.json({ plan, weeks: [], versionId: null });
  }

  const weeks = await prisma.week.findMany({
    where: { planVersionId: targetVersionId },
    orderBy: { weekNumber: "asc" },
    include: {
      sessions: { orderBy: [{ dayOfWeek: "asc" }, { id: "asc" }] }
    }
  });

  const activities = await prisma.activity.findMany({
    where: { planId: id },
    orderBy: { startedAt: "asc" }
  });

  return NextResponse.json({
    plan,
    weeks,
    versionId: targetVersionId,
    activities
  });
}
