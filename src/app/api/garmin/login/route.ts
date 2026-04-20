import { NextRequest, NextResponse } from "next/server";
import { postLogin, SidecarDownError } from "@/lib/garmin-sidecar";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!body.email || !body.password) {
    return NextResponse.json(
      { status: "error", error: "email and password are required" },
      { status: 400 }
    );
  }
  try {
    const result = await postLogin(body.email, body.password);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SidecarDownError) {
      return NextResponse.json(
        { status: "error", error: err.message, code: "SIDECAR_DOWN" },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 }
    );
  }
}
