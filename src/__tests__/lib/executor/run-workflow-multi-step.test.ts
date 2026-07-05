import { beforeEach, describe, it, expect, vi } from "vitest";
import { runWorkflowMultiStep } from "@/lib/executor/run-workflow-multi-step";
import { completeWorkflowRun, failWorkflowRun } from "@/lib/workflow-runs";
import type { WorkspaceScenario } from "@/lib/workspace-presets";

vi.mock("@/lib/workflow-runs", () => ({
  advanceWorkflowRun: vi.fn(),
  completeWorkflowRun: vi.fn(),
  failWorkflowRun: vi.fn(),
}));

function makeScenario(stageCount: number): WorkspaceScenario {
  return {
    id: "test-scenario",
    title: "Test Workflow",
    description: "test",
    workflowStages: Array.from({ length: stageCount }, (_, i) => ({
      id: `stage_${i}`,
      title: `Stage ${i}`,
      mode: i === 0 ? "auto" as const : "review" as const,
    })),
  } as unknown as WorkspaceScenario;
}

function makeSalesScenario(): WorkspaceScenario {
  return {
    ...makeScenario(5),
    id: "sales-pipeline",
    title: "Sales Pipeline Desk",
  } as WorkspaceScenario;
}

describe("runWorkflowMultiStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for ineligible scenarios (< 2 stages)", async () => {
    const result = await runWorkflowMultiStep({
      runId: "run-1",
      scenario: makeScenario(1),
    });
    expect(result).toBe(false);
  });

  it("calls stream endpoint for eligible scenarios", async () => {
    const ssePayload = [
      "event: step_complete\n",
      `data: ${JSON.stringify({ stepId: "stage_0", status: "completed", durationMs: 100, tokensUsed: 50, toolCallResults: [] })}\n`,
      "\n",
      "event: step_complete\n",
      `data: ${JSON.stringify({ stepId: "stage_1", status: "completed", durationMs: 200, tokensUsed: 80, toolCallResults: [] })}\n`,
      "\n",
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: true })}\n`,
      "\n",
    ].join("");

    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(ssePayload) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const onStepComplete = vi.fn();
    const result = await runWorkflowMultiStep({
      runId: "run-2",
      scenario: makeScenario(2),
      onStepComplete,
    });

    expect(result).toBe(true);
    expect(onStepComplete).toHaveBeenCalledTimes(2);
  });

  it("sends controlled playbook identity for eligible workflow scenarios", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    });
    global.fetch = fetchMock;

    await runWorkflowMultiStep({
      runId: "run-sales-1",
      scenario: makeSalesScenario(),
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body))).toMatchObject({
      workflowRunId: "run-sales-1",
      scenarioId: "sales-pipeline",
      playbookId: "sales-pipeline-v1",
      approvalMode: "each-review-step",
    });
  });

  it("calls failWorkflowRun on HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, body: null });

    const onError = vi.fn();
    const result = await runWorkflowMultiStep({
      runId: "run-3",
      scenario: makeScenario(2),
      onError,
    });

    expect(result).toBe(true);
    expect(onError).toHaveBeenCalledWith("Stream failed: HTTP 500");
  });

  it("fails the workflow instead of completing it when stream execution reports failure", async () => {
    const ssePayload = [
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: false, error: "approval rejected" })}\n`,
      "\n",
    ].join("");

    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(ssePayload) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const onError = vi.fn();
    const result = await runWorkflowMultiStep({
      runId: "run-4",
      scenario: makeScenario(2),
      onError,
    });

    expect(result).toBe(true);
    expect(completeWorkflowRun).not.toHaveBeenCalled();
    expect(failWorkflowRun).toHaveBeenCalledWith("run-4");
    expect(onError).toHaveBeenCalledWith("approval rejected");
  });

  it("does not duplicate failure callbacks when an error is followed by failed execution_done", async () => {
    const ssePayload = [
      "event: error\n",
      `data: ${JSON.stringify({ error: "approval rejected" })}\n`,
      "\n",
      "event: execution_done\n",
      `data: ${JSON.stringify({ ok: false, error: "approval rejected" })}\n`,
      "\n",
    ].join("");

    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(ssePayload) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const onError = vi.fn();
    const result = await runWorkflowMultiStep({
      runId: "run-duplicate-failure",
      scenario: makeScenario(2),
      onError,
    });

    expect(result).toBe(true);
    expect(completeWorkflowRun).not.toHaveBeenCalled();
    expect(failWorkflowRun).toHaveBeenCalledTimes(1);
    expect(failWorkflowRun).toHaveBeenCalledWith("run-duplicate-failure");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("approval rejected");
  });

  it("does not complete the workflow when the stream ends before execution_done", async () => {
    const ssePayload = [
      "event: step_complete\n",
      `data: ${JSON.stringify({ stepId: "stage_0", status: "completed", durationMs: 100, tokensUsed: 50, toolCallResults: [] })}\n`,
      "\n",
      "event: step_complete\n",
      `data: ${JSON.stringify({ stepId: "stage_1", status: "completed", durationMs: 200, tokensUsed: 80, toolCallResults: [] })}\n`,
      "\n",
    ].join("");

    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(ssePayload) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const onError = vi.fn();
    const result = await runWorkflowMultiStep({
      runId: "run-5",
      scenario: makeScenario(2),
      onError,
    });

    expect(result).toBe(true);
    expect(completeWorkflowRun).not.toHaveBeenCalled();
    expect(failWorkflowRun).toHaveBeenCalledWith("run-5");
    expect(onError).toHaveBeenCalledWith("Stream ended before execution_done");
  });
});
