import { NextResponse } from "next/server";
import { listExecutorSessions } from "@/lib/server/executor-session-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await listExecutorSessions();
    return NextResponse.json(
      { ok: true, data: { sessions } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load executor sessions.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
