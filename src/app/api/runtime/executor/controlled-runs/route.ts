import { NextResponse } from "next/server";

import type { AgentCoreExecutorLlmConfig, AgentCoreTaskRequest, ExecutionCallbacks } from "@/lib/executor/contracts";
import { runMultiStepTask } from "@/lib/executor/core";
import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import { isDemoPlaybookId, getDemoFixture } from "@/lib/executor/runtime/demo-fixtures";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { isAllowedOutboundUrl } from "@/lib/server/network-policy";
import { RequestBodyError, readJsonBodyWithLimit } from "@/lib/server/request-body";
import {
  getControlledExecutionRun,
  listControlledExecutionRuns,
} from "@/lib/server/controlled-execution-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const runs = await listControlledExecutionRuns();
    return NextResponse.json(
      { ok: true, data: { runs } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load controlled runs.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const silentCallbacks: ExecutionCallbacks = {
  onPlanReady() {},
  onStepStart() {},
  onStepProgress() {},
  onStepComplete() {},
  onAwaitingApproval() {},
  async waitForApproval() {
    return { approved: false, feedback: "Demo run paused before approval" };
  },
  onError() {},
};

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  let body: null | {
    playbookId?: unknown;
    mode?: unknown;
    llm?: AgentCoreExecutorLlmConfig | null;
    externalWritebackUrl?: unknown;
  };
  try {
    body = (await readJsonBodyWithLimit(req, 20_000)) as null | {
      playbookId?: unknown;
      mode?: unknown;
      llm?: AgentCoreExecutorLlmConfig | null;
      externalWritebackUrl?: unknown;
    };
  } catch (error) {
    const message = error instanceof RequestBodyError ? error.message : "Invalid request body";
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
  const playbookId = typeof body?.playbookId === "string" ? body.playbookId.trim() : "";
  if (!isDemoPlaybookId(playbookId)) {
    return NextResponse.json(
      { ok: false, error: "playbookId must be sales-pipeline-v1 or support-resolution-v1" },
      { status: 400 },
    );
  }
  const mode = body?.mode === "model" ? "model" : "fixture";
  const apiKey = String(body?.llm?.apiKey ?? "").trim();
  if (mode === "model" && !apiKey) {
    return NextResponse.json({ ok: false, error: "缺少 Kimi API Key" }, { status: 400 });
  }
  const externalWritebackUrl =
    typeof body?.externalWritebackUrl === "string" ? body.externalWritebackUrl.trim() : "";
  if (externalWritebackUrl && playbookId !== "sales-pipeline-v1") {
    return NextResponse.json(
      { ok: false, error: "外部写回目前只接销售剧本的批准结果" },
      { status: 400 },
    );
  }
  if (externalWritebackUrl && !isAllowedOutboundUrl(externalWritebackUrl)) {
    return NextResponse.json(
      { ok: false, error: "写回地址不在允许的外连范围内" },
      { status: 400 },
    );
  }

  const playbook = getControlledPlaybook(playbookId);
  if (!playbook) {
    return NextResponse.json({ ok: false, error: "Playbook is not registered" }, { status: 400 });
  }

  const fixture = getDemoFixture(playbookId);
  const requestId = `${mode === "model" ? "model" : "demo"}-${crypto.randomUUID()}`;
  const request: AgentCoreTaskRequest = {
    taskInput: { userMessage: fixture.userMessage },
    session: { id: mode === "model" ? "controlled-model" : "controlled-demo" },
    metadata: {
      requestId,
      idempotencyKey: requestId,
      source: mode === "model" ? "controlled-model" : "controlled-demo",
      ...(externalWritebackUrl ? { externalWritebackUrl } : {}),
    },
    context: {
      systemPrompt: "",
      workspace: { activeScenarioId: playbook.scenarioId, workflowRunId: requestId },
    },
    skillPolicy: { enabled: false, mode: "off" },
    modelConfig:
      mode === "model"
        ? {
            provider: body?.llm?.provider || "kimi",
            apiKey,
            baseUrl: body?.llm?.baseUrl,
            model: body?.llm?.model,
          }
        : undefined,
    executionPolicy: {
      timeoutSeconds: mode === "model" ? 90 : 30,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
    multiStep: { enabled: true, maxSteps: playbook.steps.length, approvalMode: "each-review-step" },
    controlledPlaybookId: playbook.id,
  };

  const result = await runMultiStepTask(request, silentCallbacks, { pauseOnApprovalRequired: true });
  const run = await getControlledExecutionRun(requestId);
  if (!run || run.state !== "awaiting_approval" || run.currentStepId !== "human_review") {
    return NextResponse.json(
      {
        ok: false,
        error: result.error || run?.error || "Demo run did not pause at human_review",
        data: run ? { run } : undefined,
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { ok: true, data: { run } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
