import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      raceDistance: true,
      raceDate: true,
      startDate: true,
      createdAt: true
    }
  });
  return NextResponse.json({ plans });
}
