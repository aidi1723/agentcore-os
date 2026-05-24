import { describe, it, expect, vi } from "vitest";
import { runWorkflowMultiStep } from "@/lib/executor/run-workflow-multi-step";
import type { WorkspaceScenario } from "@/lib/workspace-presets";

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

describe("runWorkflowMultiStep", () => {
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
});
