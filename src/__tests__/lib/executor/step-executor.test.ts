import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeMultiStep } from "@/lib/executor/step-executor";
import { registerTool } from "@/lib/executor/tools/registry";
import type {
  AgentCoreTaskRequest,
  ExecutionCallbacks,
  ExecutionPlan,
  ExecutionStep,
} from "@/lib/executor/contracts";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "step-executor-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: "step_1",
    title: "Test",
    description: "test step",
    toolCalls: [],
    dependsOn: [],
    mode: "auto",
    ...overrides,
  };
}

function makePlan(steps: ExecutionStep[]): ExecutionPlan {
  return { id: "plan_1", goal: "test", steps, totalSteps: steps.length, requiresApproval: false };
}

function makeRequest(): AgentCoreTaskRequest {
  return {
    session: { id: "sess_1" },
    taskInput: { userMessage: "test" },
    context: { systemPrompt: "", workspace: null },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {},
    metadata: { source: "test", requestId: "req_1", idempotencyKey: "idem_1" },
    multiStep: { enabled: true, maxSteps: 10, approvalMode: "each-review-step" },
  } as unknown as AgentCoreTaskRequest;
}

function makeControlledRequest(): AgentCoreTaskRequest {
  return {
    ...makeRequest(),
    controlledPlaybookId: "sales-pipeline-v1",
    multiStep: { enabled: true, maxSteps: 10, approvalMode: "none" },
  };
}

function makeCallbacks(): ExecutionCallbacks & { events: Array<{ type: string; data?: unknown }> } {
  const events: Array<{ type: string; data?: unknown }> = [];
  return {
    events,
    onPlanReady: vi.fn(() => events.push({ type: "plan_ready" })),
    onStepStart: vi.fn((step, i) => events.push({ type: "step_start", data: { stepId: step.id, i } })),
    onStepProgress: vi.fn(),
    onStepComplete: vi.fn((result) => events.push({ type: "step_complete", data: result })),
    onAwaitingApproval: vi.fn((step) => events.push({ type: "awaiting", data: step.id })),
    waitForApproval: vi.fn(async () => ({ approved: true })),
    onError: vi.fn((err) => events.push({ type: "error", data: err })),
  };
}

describe("step-executor", () => {
  it("requires approval for auto-mode steps that call guarded tools", async () => {
    const calls: unknown[] = [];
    registerTool({
      name: "guarded_test_tool",
      description: "guarded test tool",
      parameters: { type: "object" },
      requiresApproval: true,
      execute: async (params) => {
        calls.push(params);
        return {
          toolName: "guarded_test_tool",
          success: true,
          output: { ok: true },
          durationMs: 0,
        };
      },
    });

    const plan = makePlan([
      makeStep({ mode: "auto", toolCalls: [{ toolName: "guarded_test_tool" }] }),
    ]);
    const callbacks = makeCallbacks();
    callbacks.waitForApproval = vi.fn(async () => ({ approved: false, feedback: "blocked" }));

    const trace = await executeMultiStep(plan, makeRequest(), callbacks);

    expect(callbacks.onAwaitingApproval).toHaveBeenCalledOnce();
    expect(callbacks.waitForApproval).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(0);
    expect(trace.stepResults[0].status).toBe("failed");
    expect(trace.stepResults[0].error).toContain("blocked");
    expect(trace.success).toBe(false);
  });

  it("passes explicit tool params to tool execution", async () => {
    const calls: unknown[] = [];
    registerTool({
      name: "param_echo_tool",
      description: "param echo tool",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async (params) => {
        calls.push(params);
        return {
          toolName: "param_echo_tool",
          success: true,
          output: params,
          durationMs: 0,
        };
      },
    });

    const plan = makePlan([
      makeStep({
        toolCalls: [
          {
            toolName: "param_echo_tool",
            description: "run explicit params",
            params: { code: "print(1)", language: "python" },
          },
        ],
      }),
    ]);

    const trace = await executeMultiStep(plan, makeRequest(), makeCallbacks());

    expect(trace.success).toBe(true);
    expect(calls[0]).toEqual({
      prompt: "test step",
      description: "run explicit params",
      code: "print(1)",
      language: "python",
    });
  });

  it("executes a plan with no tool calls successfully", async () => {
    const plan = makePlan([makeStep()]);
    const callbacks = makeCallbacks();

    const trace = await executeMultiStep(plan, makeRequest(), callbacks);

    expect(trace.success).toBe(true);
    expect(trace.stepResults).toHaveLength(1);
    expect(trace.stepResults[0].status).toBe("completed");
    expect(callbacks.onPlanReady).toHaveBeenCalledOnce();
    expect(callbacks.onStepStart).toHaveBeenCalledOnce();
  });

  it("skips steps with unmet dependencies", async () => {
    const steps = [
      makeStep({ id: "s1", toolCalls: [{ toolName: "nonexistent_tool" }] }),
      makeStep({ id: "s2", dependsOn: ["s1"] }),
    ];
    const plan = makePlan(steps);
    const callbacks = makeCallbacks();

    const trace = await executeMultiStep(plan, makeRequest(), callbacks);

    // s1 fails (tool not found), s2 skipped due to dependency
    expect(trace.stepResults[0].status).toBe("failed");
    expect(trace.stepResults[1].status).toBe("skipped");
    expect(trace.success).toBe(false);
  });

  it("requests approval for review-mode steps", async () => {
    const plan = makePlan([makeStep({ mode: "review" })]);
    const callbacks = makeCallbacks();

    await executeMultiStep(plan, makeRequest(), callbacks);

    expect(callbacks.onAwaitingApproval).toHaveBeenCalledOnce();
    expect(callbacks.waitForApproval).toHaveBeenCalledOnce();
  });

  it("fails the trace when approval is denied", async () => {
    const plan = makePlan([makeStep({ mode: "review" })]);
    const callbacks = makeCallbacks();
    callbacks.waitForApproval = vi.fn(async () => ({ approved: false, feedback: "nope" }));

    const trace = await executeMultiStep(plan, makeRequest(), callbacks);

    expect(trace.stepResults[0].status).toBe("failed");
    expect(trace.stepResults[0].error).toContain("nope");
    expect(trace.success).toBe(false);
    expect(trace.error).toContain("nope");
  });

  it("requires approval for controlled review steps even when caller asks for no approvals", async () => {
    const plan = makePlan([makeStep({ mode: "review" })]);
    const callbacks = makeCallbacks();

    await executeMultiStep(plan, makeControlledRequest(), callbacks);

    expect(callbacks.onAwaitingApproval).toHaveBeenCalledOnce();
    expect(callbacks.waitForApproval).toHaveBeenCalledOnce();
  });

  it("aborts after 3 consecutive failures", async () => {
    const steps = [
      makeStep({ id: "s1", toolCalls: [{ toolName: "bad" }] }),
      makeStep({ id: "s2", toolCalls: [{ toolName: "bad" }] }),
      makeStep({ id: "s3", toolCalls: [{ toolName: "bad" }] }),
      makeStep({ id: "s4", toolCalls: [{ toolName: "bad" }] }),
    ];
    const plan = makePlan(steps);
    const callbacks = makeCallbacks();

    const trace = await executeMultiStep(plan, makeRequest(), callbacks);

    expect(callbacks.onError).toHaveBeenCalled();
    // Should not execute all 4 steps
    const executed = trace.stepResults.filter((r) => r.status !== "skipped");
    expect(executed.length).toBeLessThanOrEqual(3);
  });

  it("fails controlled execution when a step output violates its output schema", async () => {
    registerTool({
      name: "schema_bad_output_tool",
      description: "bad schema test tool",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async () => ({
        toolName: "schema_bad_output_tool",
        success: true,
        output: { wrong: true },
        durationMs: 0,
      }),
    });

    const plan = makePlan([
      makeStep({
        id: "schema_step",
        toolCalls: [{ toolName: "schema_bad_output_tool" }],
        outputSchema: {
          type: "object",
          required: ["summary"],
          properties: {
            summary: { type: "string" },
          },
          additionalProperties: false,
        },
      }),
    ]);

    const trace = await executeMultiStep(plan, makeControlledRequest(), makeCallbacks());

    expect(trace.success).toBe(false);
    expect(trace.error).toContain("Missing required field: summary");
    expect(trace.stepResults[0]?.status).toBe("failed");
  });

  it("retries failed controlled steps according to onFailure maxRetries", async () => {
    let calls = 0;
    registerTool({
      name: "flaky_retry_tool",
      description: "flaky retry tool",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async () => {
        calls += 1;
        return {
          toolName: "flaky_retry_tool",
          success: calls >= 2,
          output: calls >= 2 ? { ok: true } : null,
          durationMs: 0,
          sideEffects: calls >= 2 ? [] : ["temporary failure"],
        };
      },
    });

    const plan = makePlan([
      makeStep({
        id: "retry_step",
        toolCalls: [{ toolName: "flaky_retry_tool" }],
        onFailure: { action: "retry", maxRetries: 1 },
      }),
    ]);

    const trace = await executeMultiStep(plan, makeControlledRequest(), makeCallbacks());

    expect(calls).toBe(2);
    expect(trace.success).toBe(true);
    expect(trace.stepResults[0]?.status).toBe("completed");
  });

  it("stops controlled execution when onFailure is fail_run", async () => {
    const plan = makePlan([
      makeStep({
        id: "first",
        toolCalls: [{ toolName: "missing_tool" }],
        onFailure: { action: "fail_run" },
      }),
      makeStep({ id: "second", dependsOn: ["first"] }),
    ]);

    const callbacks = makeCallbacks();
    const trace = await executeMultiStep(plan, makeControlledRequest(), callbacks);

    expect(trace.success).toBe(false);
    expect(trace.stepResults.map((result) => result.stepId)).toEqual(["first"]);
    expect(callbacks.onError).toHaveBeenCalled();
  });
});
