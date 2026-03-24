import { NextResponse } from "next/server";
import { getExecutorSession } from "@/lib/server/executor-session-store";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const session = await getExecutorSession(sessionId);
    if (!session) {
      return NextResponse.json({ ok: false, error: "执行会话不存在" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, data: { session } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load executor session.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
