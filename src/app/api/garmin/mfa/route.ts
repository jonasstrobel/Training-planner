import { NextRequest, NextResponse } from "next/server";
import { postMfa, SidecarDownError } from "@/lib/garmin-sidecar";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) {
    return NextResponse.json(
      { status: "error", error: "code is required" },
      { status: 400 }
    );
  }
  try {
    const result = await postMfa(body.code);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SidecarDownError) {
      return NextResponse.json(
        { status: "error", error: err.message, code: "SIDECAR_DOWN" },
        { status: 503 }
      );
    }
    throw err;
  }
}
