# Controlled Run Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend resume path that continues a durable controlled execution run after an approval pause without replaying completed steps.

**Architecture:** Extend the existing step executor with explicit continuation options instead of forking a second executor. Add a focused runtime resume helper that reconstructs prior `StepResult`s from the durable run, checks durable approval state, and calls the executor from the correct step. Expose the helper through a local-authorized JSON route at `/api/runtime/executor/controlled-runs/[runId]/resume`.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing `json-store`, existing controlled execution store, existing executor contracts.

---

## Scope

This plan implements `docs/superpowers/specs/2026-07-05-controlled-run-resume-design.md`.

In scope:

- Resume `running` and `awaiting_approval` controlled runs.
- Refuse terminal runs.
- Skip completed/skipped steps.
- Use durable approval state to bypass only already-approved steps.
- Pause again at the next unapproved review/manual step.
- Return JSON with updated durable run and `resumedStepIds`.

Out of scope:

- UI trace viewer.
- Background worker.
- Auto-resume from `/api/agent/approve`.
- New playbooks.

## File Structure

Create:

- `src/lib/executor/runtime/resume.ts`
  - Runtime-level resume orchestration and reconstruction helpers.
- `src/app/api/runtime/executor/controlled-runs/[runId]/resume/route.ts`
  - Local API route that calls the resume helper.
- `src/__tests__/lib/executor/runtime/resume.test.ts`
  - Helper-level resume behavior tests.
- `src/__tests__/app/api/controlled-run-resume-route.test.ts`
  - Route-level status and response tests.

Modify:

- `src/lib/executor/step-executor.ts`
  - Add continuation options and pause-on-approval behavior.
- `src/lib/executor/contracts.ts`
  - Export the executor continuation option type used by `executeMultiStep`.
- `package.json`
  - Add new resume tests to `test:controlled-runtime`.

---

### Task 1: Add Executor Continuation Options

**Files:**

- Modify: `src/lib/executor/step-executor.ts`
- Modify: `src/lib/executor/contracts.ts`
- Test: `src/__tests__/lib/executor/step-executor.test.ts`

- [x] **Step 1: Write failing continuation tests**

Append to `src/__tests__/lib/executor/step-executor.test.ts`:

```ts
it("continues from a later step with initial completed results", async () => {
  const calls: string[] = [];
  registerTool({
    name: "resume_continuation_tool",
    description: "resume continuation test tool",
    parameters: { type: "object" },
    requiresApproval: false,
    execute: async (params) => {
      calls.push(String((params as { prompt?: string }).prompt ?? ""));
      return {
        toolName: "resume_continuation_tool",
        success: true,
        output: { resumed: true },
        durationMs: 0,
      };
    },
  });

  const plan = makePlan([
    makeStep({ id: "first", description: "first", toolCalls: [{ toolName: "resume_continuation_tool" }] }),
    makeStep({
      id: "second",
      description: "second",
      dependsOn: ["first"],
      toolCalls: [{ toolName: "resume_continuation_tool" }],
    }),
  ]);

  const trace = await executeMultiStep(plan, makeControlledRequest(), makeCallbacks(), undefined, {
    initialStepResults: [
      {
        stepId: "first",
        status: "completed",
        output: { already: true },
        toolCallResults: [],
        tokensUsed: 0,
        durationMs: 1,
      },
    ],
    startStepIndex: 1,
    suppressPlanReady: true,
  });

  expect(calls).toEqual(["second"]);
  expect(trace.stepResults.map((result) => result.stepId)).toEqual(["first", "second"]);
  expect(trace.success).toBe(true);
});

it("pauses instead of failing when resume reaches an unapproved review step", async () => {
  const callbacks = makeCallbacks();
  const plan = makePlan([
    makeStep({ id: "first" }),
    makeStep({ id: "review", mode: "review", dependsOn: ["first"] }),
  ]);

  const trace = await executeMultiStep(plan, makeControlledRequest(), callbacks, undefined, {
    initialStepResults: [
      {
        stepId: "first",
        status: "completed",
        output: { ok: true },
        toolCallResults: [],
        tokensUsed: 0,
        durationMs: 1,
      },
    ],
    startStepIndex: 1,
    pauseOnApprovalRequired: true,
    suppressPlanReady: true,
  });

  expect(callbacks.onAwaitingApproval).toHaveBeenCalledOnce();
  expect(callbacks.waitForApproval).not.toHaveBeenCalled();
  expect(trace.stepResults.at(-1)).toMatchObject({
    stepId: "review",
    status: "awaiting_approval",
  });
  expect(trace.success).toBe(false);
  expect(trace.error).toBe("Awaiting approval for review");
});

it("skips approval only for explicitly approved resume steps", async () => {
  const callbacks = makeCallbacks();
  const plan = makePlan([
    makeStep({ id: "review", mode: "review" }),
    makeStep({ id: "writeback", mode: "manual", dependsOn: ["review"] }),
  ]);

  const trace = await executeMultiStep(plan, makeControlledRequest(), callbacks, undefined, {
    approvedStepIds: ["review"],
    pauseOnApprovalRequired: true,
    suppressPlanReady: true,
  });

  expect(callbacks.waitForApproval).not.toHaveBeenCalled();
  expect(trace.stepResults.map((result) => `${result.stepId}:${result.status}`)).toEqual([
    "review:completed",
    "writeback:awaiting_approval",
  ]);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts
```

Expected: FAIL because `executeMultiStep` does not accept continuation options and cannot emit `awaiting_approval` without waiting.

- [x] **Step 3: Add continuation option type**

Modify `src/lib/executor/contracts.ts` after `ExecutionCallbacks`:

```ts
export type ExecuteMultiStepOptions = {
  initialStepResults?: StepResult[];
  startStepIndex?: number;
  approvedStepIds?: string[];
  pauseOnApprovalRequired?: boolean;
  suppressPlanReady?: boolean;
};
```

- [x] **Step 4: Update executor imports and signature**

Modify the import list in `src/lib/executor/step-executor.ts`:

```ts
  ExecuteMultiStepOptions,
```

Change the function signature:

```ts
export async function executeMultiStep(
  plan: ExecutionPlan,
  request: AgentCoreTaskRequest,
  callbacks: ExecutionCallbacks,
  guardrails?: Partial<GuardrailConfig>,
  options: ExecuteMultiStepOptions = {},
): Promise<MultiStepTrace> {
```

- [x] **Step 5: Initialize trace from continuation options**

Inside `executeMultiStep`, before building `trace`, add:

```ts
  const initialStepResults = options.initialStepResults ?? [];
  const startStepIndex =
    typeof options.startStepIndex === "number"
      ? Math.max(0, Math.min(plan.steps.length, Math.floor(options.startStepIndex)))
      : 0;
  const approvedStepIds = new Set(options.approvedStepIds ?? []);
```

Set `stepResults` and plan callback behavior:

```ts
    stepResults: [...initialStepResults],
```

Replace:

```ts
  callbacks.onPlanReady(plan);
```

With:

```ts
  if (!options.suppressPlanReady) {
    callbacks.onPlanReady(plan);
  }
```

Change the loop:

```ts
  for (let i = startStepIndex; i < plan.steps.length; i++) {
```

- [x] **Step 6: Pause at unapproved approval gates**

Replace the approval gate block in `src/lib/executor/step-executor.ts` with:

```ts
    const approvalMode = request.controlledPlaybookId
      ? "each-review-step"
      : request.multiStep?.approvalMode ?? "each-review-step";
    const needsApproval = mustAwaitApproval(step, config, approvalMode);
    const alreadyApprovedForResume = approvedStepIds.has(step.id);
    if (needsApproval && !alreadyApprovedForResume) {
      callbacks.onAwaitingApproval(step);

      if (options.pauseOnApprovalRequired) {
        const awaitingResult: StepResult = {
          stepId: step.id,
          status: "awaiting_approval",
          output: null,
          toolCallResults: [],
          tokensUsed: 0,
          durationMs: 0,
          error: `Awaiting approval for ${step.id}`,
        };
        trace.stepResults.push(awaitingResult);
        trace.error = awaitingResult.error;
        if (shouldPersistControlledTrace) {
          await updateControlledExecutionRun(reqId, {
            state: "awaiting_approval",
            currentStepId: step.id,
          }).catch(() => null);
          await updateControlledExecutionStep(reqId, step.id, {
            state: "awaiting_approval",
            error: awaitingResult.error,
          }).catch(() => null);
        }
        break;
      }

      const approval = await callbacks.waitForApproval(step.id);
      if (!approval.approved) {
        const rejectedResult: StepResult = {
          stepId: step.id,
          status: "failed",
          output: null,
          toolCallResults: [],
          tokensUsed: 0,
          durationMs: 0,
          error: approval.feedback ?? "User rejected step",
        };
        trace.stepResults.push(rejectedResult);
        trace.error = rejectedResult.error;
        callbacks.onStepComplete(rejectedResult);
        callbacks.onError(rejectedResult.error ?? "User rejected step");
        break;
      }
    }
```

- [x] **Step 7: Preserve awaiting run state at finalization**

Replace final controlled run update:

```ts
    await updateControlledExecutionRun(reqId, {
      state: trace.success ? "completed" : "failed",
      error: trace.error,
    }).catch(() => null);
```

With:

```ts
    const awaitingApproval = trace.stepResults.some(
      (result) => result.status === "awaiting_approval",
    );
    await updateControlledExecutionRun(reqId, {
      state: trace.success ? "completed" : awaitingApproval ? "awaiting_approval" : "failed",
      error: awaitingApproval ? undefined : trace.error,
    }).catch(() => null);
```

- [x] **Step 8: Run executor tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add src/lib/executor/contracts.ts src/lib/executor/step-executor.ts src/__tests__/lib/executor/step-executor.test.ts
git commit -m "feat: support controlled execution continuation"
```

---

### Task 2: Add Resume Runtime Helper

**Files:**

- Create: `src/lib/executor/runtime/resume.ts`
- Test: `src/__tests__/lib/executor/runtime/resume.test.ts`

- [x] **Step 1: Write failing resume helper tests**

Create `src/__tests__/lib/executor/runtime/resume.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerTool } from "@/lib/executor/tools/registry";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import {
  createControlledExecutionRun,
  getControlledExecutionRun,
  resolveControlledApproval,
  updateControlledExecutionRun,
  updateControlledExecutionStep,
} from "@/lib/server/controlled-execution-store";
import { resumeControlledExecutionRun } from "@/lib/executor/runtime/resume";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-resume-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);

async function seedRun() {
  await createControlledExecutionRun({
    id: "resume-run-1",
    requestId: "resume-run-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan,
  });
  await updateControlledExecutionStep("resume-run-1", "intake", {
    state: "completed",
    output: {
      summary: "lead",
      missingFields: [],
      normalizedLead: { company: "ACME" },
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "qualify", {
    state: "completed",
    output: {
      priority: "high",
      reasons: ["fit"],
      risks: [],
      nextAction: "draft",
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "draft_outreach", {
    state: "completed",
    output: {
      subject: "Hi",
      body: "Body",
      assumptions: [],
      needsHumanCheck: [],
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "human_review", {
    state: "awaiting_approval",
    approval: {
      executionId: "resume-run-1",
      stepId: "human_review",
      state: "pending",
      requestedAt: Date.now(),
    },
  });
  await updateControlledExecutionRun("resume-run-1", {
    state: "awaiting_approval",
    currentStepId: "human_review",
  });
}

function registerResumeTools(calls: string[]) {
  registerTool({
    name: "human_ask",
    description: "resume human ask",
    parameters: { type: "object" },
    requiresApproval: false,
    execute: async (params) => {
      const prompt = String((params as { prompt?: string }).prompt ?? "");
      calls.push(prompt);
      return {
        toolName: "human_ask",
        success: true,
        output: prompt.includes("把已批准结果写回")
          ? {
              salesAssetUpdated: true,
              knowledgeAssetCandidate: "Approved content",
            }
          : {
              approved: true,
              approvedBody: "Approved body",
              reviewNotes: "Approved",
            },
        durationMs: 0,
      };
    },
  });
}

describe("resumeControlledExecutionRun", () => {
  it("returns not_found for a missing run", async () => {
    const result = await resumeControlledExecutionRun("missing-run");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Controlled run not found");
  });

  it("refuses terminal runs", async () => {
    await seedRun();
    await updateControlledExecutionRun("resume-run-1", { state: "completed" });

    const result = await resumeControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toContain("Cannot resume completed controlled run");
  });

  it("does not execute tools while approval is pending", async () => {
    const calls: string[] = [];
    registerResumeTools(calls);
    await seedRun();

    const result = await resumeControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toBe("Controlled run is awaiting approval");
    expect(calls).toEqual([]);
  });

  it("continues after durable approval without replaying completed steps", async () => {
    const calls: string[] = [];
    registerResumeTools(calls);
    await seedRun();
    await resolveControlledApproval("resume-run-1", "human_review", { approved: true });

    const result = await resumeControlledExecutionRun("resume-run-1");
    const run = await getControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(true);
    expect(result.resumedStepIds).toEqual(["human_review"]);
    expect(run?.state).toBe("awaiting_approval");
    expect(run?.currentStepId).toBe("writeback");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("人工确认草稿");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/resume.test.ts
```

Expected: FAIL because `src/lib/executor/runtime/resume.ts` does not exist.

- [x] **Step 3: Implement resume helper**

Create `src/lib/executor/runtime/resume.ts`:

```ts
import type {
  AgentCoreTaskRequest,
  ExecutionCallbacks,
  StepResult,
} from "@/lib/executor/contracts";
import type {
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
} from "@/lib/executor/runtime/types";
import { executeMultiStep } from "@/lib/executor/step-executor";
import {
  getControlledExecutionRun,
  requestControlledApproval,
} from "@/lib/server/controlled-execution-store";

export type ResumeControlledExecutionRunResult =
  | {
      ok: true;
      status: 200;
      run: ControlledExecutionRunRecord;
      resumedStepIds: string[];
    }
  | {
      ok: false;
      status: 404 | 409;
      error: string;
      run?: ControlledExecutionRunRecord;
      state?: ControlledExecutionRunRecord["state"];
      currentStepId?: string;
    };

function stepDurationMs(step: ControlledExecutionStepRecord) {
  if (typeof step.startedAt === "number" && typeof step.finishedAt === "number") {
    return Math.max(0, step.finishedAt - step.startedAt);
  }
  return 0;
}

function toStepResult(step: ControlledExecutionStepRecord): StepResult | null {
  if (step.state !== "completed" && step.state !== "skipped") return null;
  return {
    stepId: step.stepId,
    status: step.state,
    output: step.output,
    toolCallResults: step.toolCallResults,
    tokensUsed: step.toolCallResults.reduce((sum, item) => sum + (item.tokensUsed ?? 0), 0),
    durationMs: stepDurationMs(step),
    error: step.error,
  };
}

function buildRequestFromRun(run: ControlledExecutionRunRecord): AgentCoreTaskRequest {
  return {
    taskInput: { userMessage: run.plan.goal },
    session: { id: run.sessionId },
    metadata: { requestId: run.id, source: "controlled-run-resume" },
    context: {
      systemPrompt: "",
      workspace: {
        workflowRunId: run.workflowRunId,
        activeScenarioId: run.scenarioId,
      },
    },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {
      timeoutSeconds: 60,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
    multiStep: {
      enabled: true,
      maxSteps: run.plan.totalSteps,
      approvalMode: "each-review-step",
    },
    controlledPlaybookId: run.playbookId,
    controlledPlan: run.plan,
  };
}

function findStartIndex(run: ControlledExecutionRunRecord) {
  return run.plan.steps.findIndex((step) => {
    const record = run.steps.find((item) => item.stepId === step.id);
    return record?.state !== "completed" && record?.state !== "skipped";
  });
}

function buildCallbacks(runId: string, newlyStarted: string[]): ExecutionCallbacks {
  return {
    onPlanReady() {},
    onStepStart(step) {
      newlyStarted.push(step.id);
    },
    onStepProgress() {},
    onStepComplete() {},
    onAwaitingApproval(step) {
      void requestControlledApproval(runId, step.id).catch(() => null);
    },
    async waitForApproval(stepId) {
      return { approved: false, feedback: `Awaiting approval for ${stepId}` };
    },
    onError() {},
  };
}

export async function resumeControlledExecutionRun(
  runId: string,
): Promise<ResumeControlledExecutionRunResult> {
  const run = await getControlledExecutionRun(runId);
  if (!run) {
    return { ok: false, status: 404, error: "Controlled run not found" };
  }

  if (run.state === "completed" || run.state === "failed" || run.state === "cancelled") {
    return {
      ok: false,
      status: 409,
      error: `Cannot resume ${run.state} controlled run`,
      run,
      state: run.state,
      currentStepId: run.currentStepId,
    };
  }

  const startStepIndex = findStartIndex(run);
  if (startStepIndex < 0) {
    return {
      ok: false,
      status: 409,
      error: "Cannot resume completed controlled run",
      run,
      state: "completed",
      currentStepId: run.currentStepId,
    };
  }

  const startStep = run.plan.steps[startStepIndex];
  const startRecord = run.steps.find((step) => step.stepId === startStep.id);
  const startApprovalState = startRecord?.approval?.state;
  const isAwaitingApprovalWithoutDecision =
    startApprovalState === "pending" ||
    startApprovalState === "timed_out" ||
    (startRecord?.state === "awaiting_approval" && !startRecord.approval);
  if (isAwaitingApprovalWithoutDecision) {
    return {
      ok: false,
      status: 409,
      error: "Controlled run is awaiting approval",
      run,
      state: "awaiting_approval",
      currentStepId: startStep.id,
    };
  }
  if (startRecord?.approval?.state === "rejected") {
    return {
      ok: false,
      status: 409,
      error: "Controlled run approval was rejected",
      run,
      state: "failed",
      currentStepId: startStep.id,
    };
  }

  const initialStepResults = run.steps
    .map(toStepResult)
    .filter((item): item is StepResult => Boolean(item));
  const approvedStepIds = run.steps
    .filter((step) => step.approval?.state === "approved")
    .map((step) => step.stepId);
  const newlyStarted: string[] = [];
  await executeMultiStep(
    run.plan,
    buildRequestFromRun(run),
    buildCallbacks(run.id, newlyStarted),
    undefined,
    {
      initialStepResults,
      startStepIndex,
      approvedStepIds,
      pauseOnApprovalRequired: true,
      suppressPlanReady: true,
    },
  );
  const updatedRun = await getControlledExecutionRun(run.id);

  return {
    ok: true,
    status: 200,
    run: updatedRun ?? run,
    resumedStepIds: newlyStarted.filter((stepId) => {
      const previous = run.steps.find((step) => step.stepId === stepId);
      return previous?.state !== "completed" && previous?.state !== "skipped";
    }),
  };
}
```

- [x] **Step 4: Run resume helper tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/resume.test.ts
```

Expected: PASS.

- [x] **Step 5: Run executor tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/lib/executor/runtime/resume.ts src/__tests__/lib/executor/runtime/resume.test.ts
git commit -m "feat: resume durable controlled runs"
```

---

### Task 3: Add Resume Route

**Files:**

- Create: `src/app/api/runtime/executor/controlled-runs/[runId]/resume/route.ts`
- Test: `src/__tests__/app/api/controlled-run-resume-route.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `src/__tests__/app/api/controlled-run-resume-route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { POST } from "@/app/api/runtime/executor/controlled-runs/[runId]/resume/route";
import {
  createControlledExecutionRun,
  updateControlledExecutionRun,
} from "@/lib/server/controlled-execution-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-resume-route-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

async function seedRun(state: "running" | "completed" | "failed" | "cancelled") {
  await createControlledExecutionRun({
    id: `route-${state}`,
    requestId: `route-${state}`,
    sessionId: "session-1",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: "plan-route-resume",
      goal: "route resume",
      totalSteps: 0,
      requiresApproval: false,
      steps: [],
    },
  });
  await updateControlledExecutionRun(`route-${state}`, { state });
}

async function seedResumableRun() {
  await createControlledExecutionRun({
    id: "route-resumable",
    requestId: "route-resumable",
    sessionId: "session-1",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: "plan-route-resumable",
      goal: "route resumable",
      totalSteps: 1,
      requiresApproval: false,
      steps: [
        {
          id: "route_step",
          title: "Route step",
          description: "Complete from the resume route",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
        },
      ],
    },
  });
}

describe("controlled run resume route", () => {
  it("returns 404 for a missing controlled run", async () => {
    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/missing/resume"),
      { params: Promise.resolve({ runId: "missing" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Controlled run not found");
  });

  it("returns 409 for terminal controlled runs", async () => {
    await seedRun("completed");

    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/route-completed/resume"),
      { params: Promise.resolve({ runId: "route-completed" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Cannot resume completed controlled run");
  });

  it("returns the updated run and resumed step ids", async () => {
    await seedResumableRun();

    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/route-resumable/resume"),
      { params: Promise.resolve({ runId: "route-resumable" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.state).toBe("completed");
    expect(data.data.resumedStepIds).toEqual(["route_step"]);
    expect(data.data.run.steps[0].state).toBe("completed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-resume-route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement route**

Create `src/app/api/runtime/executor/controlled-runs/[runId]/resume/route.ts`:

```ts
import { NextResponse } from "next/server";

import { resumeControlledExecutionRun } from "@/lib/executor/runtime/resume";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export async function POST(
  req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  const { runId } = await context.params;
  const result = await resumeControlledExecutionRun(runId);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        data: {
          runId,
          state: result.state,
          currentStepId: result.currentStepId,
        },
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      runId,
      state: result.run.state,
      resumedStepIds: result.resumedStepIds,
      run: result.run,
    },
  });
}
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-resume-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run resume helper tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/resume.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/api/runtime/executor/controlled-runs/[runId]/resume/route.ts' src/__tests__/app/api/controlled-run-resume-route.test.ts
git commit -m "feat: expose controlled run resume route"
```

---

### Task 4: Extend Controlled Runtime Gate And Verify

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add resume tests to controlled runtime gate**

Replace the `test:controlled-runtime` script in `package.json` with:

```json
"test:controlled-runtime": "vitest run src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts src/__tests__/lib/executor/playbooks/validator.test.ts src/__tests__/lib/executor/runtime/schema.test.ts src/__tests__/lib/executor/runtime/step-input.test.ts src/__tests__/lib/executor/runtime/resume.test.ts src/__tests__/lib/server/controlled-execution-store.test.ts src/__tests__/lib/executor/approval-store.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts src/__tests__/lib/executor/step-executor.test.ts src/__tests__/lib/executor/run-workflow-multi-step.test.ts src/__tests__/app/api/agent-stream-route.test.ts src/__tests__/app/api/controlled-run-route.test.ts src/__tests__/app/api/controlled-run-resume-route.test.ts src/__tests__/hooks/useMultiStepStream.test.tsx"
```

- [ ] **Step 2: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS.

- [ ] **Step 3: Run core workflow regression**

Run:

```bash
npm run test:core-workflows
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS. Existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` is acceptable if still present and unchanged.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS. Existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` is acceptable if still present and unchanged.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "test: include controlled run resume gate"
```

---

## Self-Review Checklist

- Resume uses durable state as authority.
- Completed and skipped steps are not replayed.
- Approval bypass is explicit per approved step ID, not global.
- Resume pauses at the next unapproved approval gate instead of failing the run.
- Route status codes are deterministic: `404` missing, `409` terminal or waiting, `200` resumed.
- Existing stream and approval routes remain compatible.
- Final verification includes controlled runtime, core workflows, lint, build, and full test suite if requested before completion.
