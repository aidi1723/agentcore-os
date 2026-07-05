import { describe, expect, it, vi } from "vitest";

import { runMultiStepTask } from "@/lib/executor/core";
import { registerTool } from "@/lib/executor/tools/registry";
import type {
  AgentCoreTaskRequest,
  ExecutionCallbacks,
} from "@/lib/executor/contracts";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";

registerTool({
  name: "llm_generate",
  description: "test LLM generator",
  parameters: { type: "object" },
  requiresApproval: false,
  execute: async () => ({
    toolName: "llm_generate",
    success: true,
    output: { ok: true },
    durationMs: 0,
  }),
});

function buildRequest(): AgentCoreTaskRequest {
  const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
  return {
    taskInput: { userMessage: "Execute controlled sales pipeline" },
    session: { id: "test-sales-session" },
    metadata: { requestId: "controlled-runtime-test", source: "test" },
    context: {
      systemPrompt: "",
      workspace: { activeScenarioId: "sales-pipeline" },
    },
    skillPolicy: { enabled: false, mode: "off" },
    modelConfig: {
      provider: "openai",
      apiKey: "test-key",
      baseUrl: "http://127.0.0.1:65535/v1",
      model: "test-model",
    },
    executionPolicy: {
      timeoutSeconds: 30,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
    multiStep: {
      enabled: true,
      maxSteps: 5,
      approvalMode: "none",
    },
    controlledPlaybookId: "sales-pipeline-v1",
    controlledPlan: plan,
  };
}

function buildCallbacks() {
  const events: string[] = [];
  const callbacks: ExecutionCallbacks = {
    onPlanReady(plan) {
      events.push(`plan:${plan.id}`);
    },
    onStepStart(step) {
      events.push(`start:${step.id}`);
    },
    onStepProgress() {},
    onStepComplete(result) {
      events.push(`complete:${result.stepId}:${result.status}`);
    },
    onAwaitingApproval(step) {
      events.push(`approval:${step.id}`);
    },
    waitForApproval: vi.fn(async () => ({ approved: true })),
    onError(error) {
      events.push(`error:${error}`);
    },
  };
  return { callbacks, events };
}

describe("controlled runtime execution", () => {
  it("uses the supplied controlled plan instead of invoking planner fallback", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Planner should not call LLM when controlledPlan is supplied");
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = buildRequest();
    const { callbacks, events } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.trace.plan.id).toBe("playbook:sales-pipeline-v1:1.0.0");
    expect(result.trace.plan.steps.map((step) => step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(events[0]).toBe("plan:playbook:sales-pipeline-v1:1.0.0");
    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a supplied controlled plan that diverges from its playbook contract", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Planner should not call LLM when controlledPlan is supplied");
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = buildRequest();
    request.controlledPlan = {
      ...request.controlledPlan!,
      steps: request.controlledPlan!.steps.filter((step) => step.id !== "human_review"),
      totalSteps: request.controlledPlan!.totalSteps - 1,
    };
    const { callbacks, events } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid controlled playbook plan");
    expect(result.trace.success).toBe(false);
    expect(result.trace.stepResults).toHaveLength(0);
    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a supplied controlled plan that removes playbook tool calls", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const request = buildRequest();
    request.controlledPlan = {
      ...request.controlledPlan!,
      steps: request.controlledPlan!.steps.map((step) =>
        step.id === "intake" ? { ...step, toolCalls: [] } : step,
      ),
    };
    const { callbacks, events } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Step intake toolCalls must match playbook toolCalls");
    expect(result.trace.success).toBe(false);
    expect(result.trace.stepResults).toHaveLength(0);
    expect(events).toEqual([]);
  });
});
