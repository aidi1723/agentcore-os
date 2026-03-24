import { NextResponse } from "next/server";
import {
  type AgentCoreExecutorLlmConfig,
} from "@/lib/executor/core";
import { executeAgentCoreTask } from "@/lib/server/executor-runner";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const AGENT_BODY_LIMIT = 256_000;

export async function POST(req: Request) {
  try {
    const body = (await readJsonBodyWithLimit(req, AGENT_BODY_LIMIT)) as
      | null
      | {
          message?: string;
          sessionId?: string;
          timeoutSeconds?: number;
          systemPrompt?: string;
          useSkills?: boolean;
          workspaceContext?: Record<string, unknown> | null;
          llm?: AgentCoreExecutorLlmConfig | null;
        };

    const message = (body?.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ ok: false, error: "缺少 message" }, { status: 400 });
    }

    const sessionId = (body?.sessionId ?? "webos-spotlight").trim() || "webos-spotlight";
    const timeoutSeconds =
      typeof body?.timeoutSeconds === "number" && Number.isFinite(body.timeoutSeconds)
        ? Math.max(5, Math.min(600, Math.floor(body.timeoutSeconds)))
        : 60;

    const r = await executeAgentCoreTask({
      message,
      sessionId,
      timeoutSeconds,
      systemPrompt: typeof body?.systemPrompt === "string" ? body.systemPrompt : "",
      useSkills: body?.useSkills !== false,
      workspaceContext:
        body?.workspaceContext && typeof body.workspaceContext === "object"
          ? body.workspaceContext
          : null,
      llm: body?.llm ?? null,
      source: "api/openclaw/agent",
    });
    if (!r.ok) {
      return NextResponse.json(r, { status: 502 });
    }
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(err, 500) },
    );
  }
}
