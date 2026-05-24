import { NextResponse } from "next/server";

import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { readJsonBodyWithLimit } from "@/lib/server/request-body";
import { runMultiStepTask } from "@/lib/executor/core";
import { normalizeAgentCoreTaskRequest } from "@/lib/executor/contracts";
import { waitForApproval } from "@/lib/executor/approval-store";
import type {
  ExecutionCallbacks,
  ExecutionPlan,
  ExecutionStep,
  StepResult,
} from "@/lib/executor/contracts";

const BODY_LIMIT = 500_000;

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  const body = (await readJsonBodyWithLimit(req, BODY_LIMIT)) as null | Record<string, unknown>;
  if (!body || typeof body.message !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing message field" },
      { status: 400 },
    );
  }

  const normalized = normalizeAgentCoreTaskRequest({
    message: body.message as string,
    sessionId: (body.sessionId as string) ?? undefined,
    source: "multi-step-stream",
    useSkills: true,
    ...(body.llm ? { llm: body.llm as any } : {}),
    ...(body.fallbackLlm ? { fallbackLlm: body.fallbackLlm as any } : {}),
  });

  normalized.multiStep = {
    enabled: true,
    maxSteps: typeof body.maxSteps === "number" ? Math.min(body.maxSteps as number, 15) : 10,
    approvalMode:
      body.approvalMode === "none" || body.approvalMode === "final"
        ? body.approvalMode
        : "each-review-step",
  };

  const encoder = new TextEncoder();
  const executionId = normalized.metadata.requestId;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const callbacks: ExecutionCallbacks = {
        onPlanReady(plan: ExecutionPlan) {
          send("plan_ready", { executionId, plan });
        },
        onStepStart(step: ExecutionStep, index: number) {
          send("step_start", { executionId, stepId: step.id, title: step.title, index });
        },
        onStepProgress(stepId: string, data: unknown) {
          send("step_progress", { executionId, stepId, data });
        },
        onStepComplete(result: StepResult) {
          send("step_complete", { executionId, ...result });
        },
        onAwaitingApproval(step: ExecutionStep) {
          send("approval_needed", {
            executionId,
            stepId: step.id,
            title: step.title,
            description: step.description,
            mode: step.mode,
          });
        },
        waitForApproval(stepId: string) {
          return waitForApproval(executionId, stepId);
        },
        onError(error: string) {
          send("error", { executionId, error });
        },
      };

      runMultiStepTask(normalized, callbacks)
        .then((result) => {
          send("execution_done", {
            executionId,
            ok: result.ok,
            totalSteps: result.trace.plan.totalSteps,
            completedSteps: result.trace.stepResults.filter((r) => r.status === "completed").length,
            durationMs: result.trace.durationMs,
            error: result.error,
          });
          controller.close();
        })
        .catch((err) => {
          send("error", {
            executionId,
            error: err instanceof Error ? err.message : String(err),
          });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Execution-Id": executionId,
    },
  });
}
