import { NextResponse } from "next/server";
import { getExecutorSession } from "@/lib/server/executor-session-store";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

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
