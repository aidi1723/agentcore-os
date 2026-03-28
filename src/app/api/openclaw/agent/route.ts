import { NextResponse } from "next/server";
import {
  type AgentCoreExecutorLlmConfig,
  type AgentCoreLegacyTaskRequest,
  normalizeAgentCoreTaskRequest,
} from "@/lib/executor/contracts";
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
      | (AgentCoreLegacyTaskRequest & {
          llm?: AgentCoreExecutorLlmConfig | null;
        });

    const request = normalizeAgentCoreTaskRequest(body ?? {}, {
      sessionId: "webos-spotlight",
    });
    if (!request.taskInput.userMessage) {
      return NextResponse.json({ ok: false, error: "缺少 message" }, { status: 400 });
    }

    const r = await executeAgentCoreTask({
      ...request,
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
