import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as { notes?: string };
  const updated = await prisma.week.update({
    where: { id },
    data: { notes: body.notes ?? null }
  });
  return NextResponse.json({ week: { id: updated.id, notes: updated.notes } });
}
