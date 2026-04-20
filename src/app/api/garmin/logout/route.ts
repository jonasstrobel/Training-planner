import { NextResponse } from "next/server";
import { postLogout, SidecarDownError } from "@/lib/garmin-sidecar";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await postLogout();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SidecarDownError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 503 }
      );
    }
    throw err;
  }
}
