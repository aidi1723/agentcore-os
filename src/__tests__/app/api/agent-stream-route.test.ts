import { describe, expect, it, vi, beforeEach } from "vitest";

import type {
  AgentCoreTaskRequest,
  ExecutionCallbacks,
  MultiStepTrace,
} from "@/lib/executor/contracts";

const runMultiStepTaskMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/executor/core", () => ({
  runMultiStepTask: runMultiStepTaskMock,
}));

import { POST } from "@/app/api/agent/stream/route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/agent/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "localhost",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/agent/stream", () => {
  beforeEach(() => {
    runMultiStepTaskMock.mockReset();
  });

  it("forces review-step approval mode for controlled playbook executions", async () => {
    let capturedRequest: AgentCoreTaskRequest | undefined;
    const getCapturedRequest = () => capturedRequest;
    runMultiStepTaskMock.mockImplementation(
      async (request: AgentCoreTaskRequest, _callbacks: ExecutionCallbacks) => {
        capturedRequest = request;
        const now = Date.now();
        const trace: MultiStepTrace = {
          source: request.metadata.source,
          engine: "agentcore_executor",
          sessionId: request.session.id,
          requestId: request.metadata.requestId,
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          attemptCount: 0,
          fallbackUsed: false,
          attempts: [],
          skillReceipts: [],
          success: true,
          plan: request.controlledPlan!,
          stepResults: [],
          currentStepIndex: 0,
        };
        return { ok: true, trace };
      },
    );

    const response = await POST(
      makeRequest({
        message: "Run sales pipeline",
        playbookId: "sales-pipeline-v1",
        approvalMode: "none",
      }),
    );
    await response.text();

    const request = getCapturedRequest();
    expect(response.status).toBe(200);
    expect(request).toBeDefined();
    if (!request) throw new Error("Expected captured agent request");
    expect(request.controlledPlaybookId).toBe("sales-pipeline-v1");
    expect(request.multiStep?.approvalMode).toBe("each-review-step");
  });

  it("includes controlled run metadata in execution_done", async () => {
    runMultiStepTaskMock.mockImplementation(async (request: AgentCoreTaskRequest) => {
      const now = Date.now();
      return {
        ok: true,
        trace: {
          source: request.metadata.source,
          engine: "agentcore_executor",
          sessionId: request.session.id,
          requestId: request.metadata.requestId,
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          attemptCount: 0,
          fallbackUsed: false,
          attempts: [],
          skillReceipts: [],
          success: true,
          plan: request.controlledPlan!,
          stepResults: [],
          currentStepIndex: 0,
        },
      };
    });

    const response = await POST(
      makeRequest({
        message: "Run sales pipeline",
        workflowRunId: "workflow-stream-1",
        playbookId: "sales-pipeline-v1",
      }),
    );
    const text = await response.text();

    expect(text).toContain('"playbookId":"sales-pipeline-v1"');
    expect(text).toContain('"workflowRunId":"workflow-stream-1"');
  });
});
