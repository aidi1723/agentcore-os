import { NextResponse } from "next/server";
import { runOpenClawAgent } from "@/lib/openclaw-cli";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | { message?: string; sessionId?: string; timeoutSeconds?: number };

    const message = (body?.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ ok: false, error: "缺少 message" }, { status: 400 });
    }

    const sessionId = (body?.sessionId ?? "webos-spotlight").trim() || "webos-spotlight";
    const timeoutSeconds =
      typeof body?.timeoutSeconds === "number" && Number.isFinite(body.timeoutSeconds)
        ? Math.max(5, Math.min(600, Math.floor(body.timeoutSeconds)))
        : 60;

    const r = await runOpenClawAgent({
      message,
      sessionId,
      timeoutSeconds,
    });
    if (!r.ok) {
      return NextResponse.json(r, { status: 502 });
    }
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
