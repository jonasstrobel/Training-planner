import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function decodeJwtExpiry(token: string): Date | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { exp?: number };
    if (payload.exp) return new Date(payload.exp * 1000);
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  const cred = await prisma.garminCredential.findUnique({ where: { id: 1 } });
  if (!cred) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    updatedAt: cred.updatedAt,
    expiresAt: cred.expiresAt,
    expired: cred.expiresAt ? cred.expiresAt.getTime() < Date.now() : false
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim().replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const expiresAt = decodeJwtExpiry(token);
  const saved = await prisma.garminCredential.upsert({
    where: { id: 1 },
    update: { accessToken: token, tokenType: "Bearer", expiresAt },
    create: { id: 1, accessToken: token, tokenType: "Bearer", expiresAt }
  });
  return NextResponse.json({
    connected: true,
    updatedAt: saved.updatedAt,
    expiresAt: saved.expiresAt
  });
}

export async function DELETE() {
  await prisma.garminCredential.deleteMany({ where: { id: 1 } });
  return NextResponse.json({ connected: false });
}
