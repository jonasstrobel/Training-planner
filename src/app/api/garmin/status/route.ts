import { NextResponse } from "next/server";
import { getStatus, SidecarDownError } from "@/lib/garmin-sidecar";

export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getStatus();
    return NextResponse.json(status);
  } catch (err) {
    if (err instanceof SidecarDownError) {
      return NextResponse.json(
        { connected: false, sidecar: "down", error: err.message },
        { status: 200 }
      );
    }
    throw err;
  }
}
