# Durable Controlled Execution Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make controlled playbook execution durable, recoverable, schema-validated, and auditable before adding more playbooks.

**Architecture:** Add a controlled execution runtime layer that persists run, step, approval, schema validation, and writeback state through the existing server JSON store. Keep `/api/agent/stream` and `/api/agent/approve` compatible, but make durable state the authority and SSE a projection.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing `json-store`, existing executor contracts, existing playbook validator, existing workflow and asset stores.

---

## Scope

This plan implements the design in `docs/superpowers/specs/2026-07-05-durable-controlled-execution-runtime-design.md`.

In scope:

- Add controlled execution durable store.
- Make approval records durable while retaining active in-memory waiters.
- Persist controlled run and step traces.
- Add deterministic step input construction.
- Add local JSON-schema subset validation for playbook outputs.
- Apply `onFailure` for `fail_run`, bounded `retry`, and `await_human` paused failure handling.
- Add a controlled run query route.
- Add minimal writeback receipt plumbing for existing sales pipeline targets.
- Extend `test:controlled-runtime`.

Out of scope:

- New database dependency.
- New desktop app.
- Broad trace viewer UI.
- New playbooks.
- Generic plugin marketplace.

## File Structure

Create:

- `src/lib/executor/runtime/types.ts`
  - Durable controlled execution record types.
- `src/lib/server/controlled-execution-store.ts`
  - File-backed durable run/step/approval store.
- `src/lib/executor/runtime/schema.ts`
  - Small schema validator for the subset used by controlled playbooks.
- `src/lib/executor/runtime/step-input.ts`
  - Deterministic step input builder.
- `src/lib/executor/runtime/writeback.ts`
  - Writeback adapter and receipt helpers.
- `src/app/api/runtime/executor/controlled-runs/[runId]/route.ts`
  - Debug/query route for durable controlled run records.
- `src/__tests__/lib/server/controlled-execution-store.test.ts`
  - Store-level tests.
- `src/__tests__/lib/executor/runtime/schema.test.ts`
  - Schema validator tests.
- `src/__tests__/lib/executor/runtime/step-input.test.ts`
  - Step input builder tests.
- `src/__tests__/app/api/controlled-run-route.test.ts`
  - Query route tests.

Modify:

- `src/lib/executor/approval-store.ts`
  - Keep active waiters, but persist approval state through `controlled-execution-store`.
- `src/app/api/agent/approve/route.ts`
  - Update durable approval state before resolving active waiter.
- `src/lib/executor/step-executor.ts`
  - Create/update durable step records, validate outputs, apply retry/failure policies, and persist trace details.
- `src/lib/executor/core.ts`
  - Create a durable controlled run before executing validated controlled plans.
- `src/app/api/agent/stream/route.ts`
  - Include durable run fields in streamed events and create/resume controlled runs.
- `src/lib/executor/run-workflow-multi-step.ts`
  - Continue to consume existing stream events, but tolerate durable metadata.
- `src/__tests__/lib/executor/controlled-runtime.test.ts`
  - Add integration tests for durable trace, schema failure, approval persistence, and retry.
- `src/__tests__/app/api/agent-stream-route.test.ts`
  - Assert stream creates durable controlled run metadata.
- `package.json`
  - Extend `test:controlled-runtime` with new tests.

---

### Task 1: Add Durable Controlled Execution Store

**Files:**

- Create: `src/lib/executor/runtime/types.ts`
- Create: `src/lib/server/controlled-execution-store.ts`
- Test: `src/__tests__/lib/server/controlled-execution-store.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/__tests__/lib/server/controlled-execution-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExecutionPlan } from "@/lib/executor/contracts";

let tmpDir: string;
let originalCwd: () => string;

const plan: ExecutionPlan = {
  id: "playbook:sales-pipeline-v1:1.0.0",
  goal: "Sales Pipeline Controlled Runtime",
  totalSteps: 2,
  requiresApproval: true,
  steps: [
    {
      id: "intake",
      title: "Intake",
      description: "Collect lead",
      mode: "assist",
      dependsOn: [],
      toolCalls: [{ toolName: "llm_generate" }],
    },
    {
      id: "human_review",
      title: "Review",
      description: "Review output",
      mode: "review",
      dependsOn: ["intake"],
      toolCalls: [{ toolName: "human_ask" }],
    },
  ],
};

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-store-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("controlled-execution-store", () => {
  it("creates and reads a controlled execution run", async () => {
    const { createControlledExecutionRun, getControlledExecutionRun } = await import(
      "@/lib/server/controlled-execution-store"
    );

    await createControlledExecutionRun({
      id: "exec-1",
      requestId: "req-1",
      sessionId: "session-1",
      workflowRunId: "workflow-1",
      scenarioId: "sales-pipeline",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });

    const run = await getControlledExecutionRun("exec-1");

    expect(run?.id).toBe("exec-1");
    expect(run?.state).toBe("running");
    expect(run?.steps.map((step) => step.stepId)).toEqual(["intake", "human_review"]);
    expect(run?.steps.map((step) => step.state)).toEqual(["pending", "pending"]);
  });

  it("updates step state and stores tool output", async () => {
    const {
      createControlledExecutionRun,
      getControlledExecutionRun,
      updateControlledExecutionStep,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "exec-2",
      requestId: "req-2",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await updateControlledExecutionStep("exec-2", "intake", {
      state: "completed",
      input: { message: "hello" },
      output: { summary: "lead" },
      toolCallResults: [
        { toolName: "llm_generate", success: true, output: { summary: "lead" }, durationMs: 1 },
      ],
    });

    const run = await getControlledExecutionRun("exec-2");
    const step = run?.steps.find((item) => item.stepId === "intake");

    expect(step?.state).toBe("completed");
    expect(step?.input).toEqual({ message: "hello" });
    expect(step?.output).toEqual({ summary: "lead" });
    expect(step?.toolCallResults).toHaveLength(1);
  });

  it("persists and resolves approval records", async () => {
    const {
      createControlledExecutionRun,
      getControlledExecutionRun,
      requestControlledApproval,
      resolveControlledApproval,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "exec-3",
      requestId: "req-3",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await requestControlledApproval("exec-3", "human_review");
    await resolveControlledApproval("exec-3", "human_review", {
      approved: false,
      feedback: "Needs revision",
    });

    const run = await getControlledExecutionRun("exec-3");
    const step = run?.steps.find((item) => item.stepId === "human_review");

    expect(run?.state).toBe("failed");
    expect(step?.approval).toMatchObject({
      state: "rejected",
      feedback: "Needs revision",
    });
  });

  it("queries runs by workflowRunId and requestId", async () => {
    const {
      createControlledExecutionRun,
      findControlledExecutionRunByRequestId,
      listControlledExecutionRuns,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "exec-4",
      requestId: "req-4",
      sessionId: "session-1",
      workflowRunId: "workflow-4",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });

    expect((await findControlledExecutionRunByRequestId("req-4"))?.id).toBe("exec-4");
    expect((await listControlledExecutionRuns({ workflowRunId: "workflow-4" }))[0]?.id).toBe(
      "exec-4",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Expected: FAIL because `src/lib/server/controlled-execution-store.ts` does not exist.

- [ ] **Step 3: Add runtime types**

Create `src/lib/executor/runtime/types.ts`:

```ts
import type { ExecutionPlan, ToolCallResult } from "@/lib/executor/contracts";

export type ControlledExecutionRunState =
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type ControlledExecutionStepState =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export type ControlledApprovalRecord = {
  executionId: string;
  stepId: string;
  state: "pending" | "approved" | "rejected" | "timed_out";
  requestedAt: number;
  resolvedAt?: number;
  feedback?: string;
  approver?: "local_user";
};

export type ControlledSchemaValidationRecord = {
  valid: boolean;
  errors: string[];
  checkedAt: number;
};

export type ControlledWritebackReceipt = {
  target: string;
  ok: boolean;
  summary: string;
  writtenAt: number;
};

export type ControlledExecutionStepRecord = {
  stepId: string;
  state: ControlledExecutionStepState;
  startedAt?: number;
  finishedAt?: number;
  input: unknown;
  output: unknown;
  error?: string;
  attempts: number;
  toolCallResults: ToolCallResult[];
  approval?: ControlledApprovalRecord;
  schemaValidation?: ControlledSchemaValidationRecord;
  writebackReceipts: ControlledWritebackReceipt[];
};

export type ControlledExecutionRunRecord = {
  id: string;
  requestId: string;
  sessionId: string;
  workflowRunId?: string;
  scenarioId?: string;
  playbookId: string;
  playbookVersion: string;
  planId: string;
  state: ControlledExecutionRunState;
  currentStepId?: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  error?: string;
  plan: ExecutionPlan;
  steps: ControlledExecutionStepRecord[];
};
```

- [ ] **Step 4: Implement durable store**

Create `src/lib/server/controlled-execution-store.ts`:

```ts
import type { ExecutionPlan } from "@/lib/executor/contracts";
import type {
  ControlledApprovalRecord,
  ControlledExecutionRunRecord,
  ControlledExecutionRunState,
  ControlledExecutionStepRecord,
} from "@/lib/executor/runtime/types";
import { redactSensitiveText } from "@/lib/executor/redaction";
import { readJsonFile, readModifyWrite } from "@/lib/server/json-store";

const FILE_NAME = "controlled-execution-runs.json";
const MAX_RUNS = 400;

function now() {
  return Date.now();
}

function clipError(value?: string) {
  if (!value) return undefined;
  const redacted = redactSensitiveText(value).trim();
  return redacted ? redacted.slice(0, 4_000) : undefined;
}

function normalizeRun(input: unknown): ControlledExecutionRunRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as ControlledExecutionRunRecord;
  if (!item.id || !item.requestId || !item.sessionId || !item.playbookId || !item.plan) {
    return null;
  }

  return {
    id: String(item.id),
    requestId: String(item.requestId),
    sessionId: String(item.sessionId),
    workflowRunId: item.workflowRunId ? String(item.workflowRunId) : undefined,
    scenarioId: item.scenarioId ? String(item.scenarioId) : undefined,
    playbookId: String(item.playbookId),
    playbookVersion: String(item.playbookVersion || ""),
    planId: String(item.planId || item.plan.id),
    state: item.state || "running",
    currentStepId: item.currentStepId,
    createdAt: Number.isFinite(item.createdAt) ? item.createdAt : now(),
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : now(),
    finishedAt: Number.isFinite(item.finishedAt) ? item.finishedAt : undefined,
    error: clipError(item.error),
    plan: item.plan,
    steps: Array.isArray(item.steps) ? item.steps.map(normalizeStep) : [],
  };
}

function normalizeStep(input: ControlledExecutionStepRecord): ControlledExecutionStepRecord {
  return {
    stepId: String(input.stepId),
    state: input.state || "pending",
    startedAt: Number.isFinite(input.startedAt) ? input.startedAt : undefined,
    finishedAt: Number.isFinite(input.finishedAt) ? input.finishedAt : undefined,
    input: input.input ?? null,
    output: input.output ?? null,
    error: clipError(input.error),
    attempts: Number.isFinite(input.attempts) ? Math.max(0, Math.floor(input.attempts)) : 0,
    toolCallResults: Array.isArray(input.toolCallResults) ? input.toolCallResults : [],
    approval: input.approval,
    schemaValidation: input.schemaValidation,
    writebackReceipts: Array.isArray(input.writebackReceipts) ? input.writebackReceipts : [],
  };
}

async function readRuns() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return raw
    .map(normalizeRun)
    .filter((item): item is ControlledExecutionRunRecord => Boolean(item))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_RUNS);
}

function buildInitialSteps(plan: ExecutionPlan): ControlledExecutionStepRecord[] {
  return plan.steps.map((step) => ({
    stepId: step.id,
    state: "pending",
    input: null,
    output: null,
    attempts: 0,
    toolCallResults: [],
    writebackReceipts: [],
  }));
}

export async function createControlledExecutionRun(input: {
  id: string;
  requestId: string;
  sessionId: string;
  workflowRunId?: string;
  scenarioId?: string;
  playbookId: string;
  playbookVersion: string;
  plan: ExecutionPlan;
}) {
  const timestamp = now();
  const run: ControlledExecutionRunRecord = {
    id: input.id,
    requestId: input.requestId,
    sessionId: input.sessionId,
    workflowRunId: input.workflowRunId,
    scenarioId: input.scenarioId,
    playbookId: input.playbookId,
    playbookVersion: input.playbookVersion,
    planId: input.plan.id,
    state: "running",
    createdAt: timestamp,
    updatedAt: timestamp,
    plan: input.plan,
    steps: buildInitialSteps(input.plan),
  };

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const runs = current
      .map(normalizeRun)
      .filter((item): item is ControlledExecutionRunRecord => Boolean(item))
      .filter((item) => item.id !== run.id && item.requestId !== run.requestId);
    return [run, ...runs].slice(0, MAX_RUNS);
  });

  return run;
}

export async function getControlledExecutionRun(id: string) {
  return (await readRuns()).find((run) => run.id === id) ?? null;
}

export async function findControlledExecutionRunByRequestId(requestId: string) {
  return (await readRuns()).find((run) => run.requestId === requestId) ?? null;
}

export async function listControlledExecutionRuns(filter?: {
  workflowRunId?: string;
  sessionId?: string;
  playbookId?: string;
}) {
  const runs = await readRuns();
  return runs.filter((run) => {
    if (filter?.workflowRunId && run.workflowRunId !== filter.workflowRunId) return false;
    if (filter?.sessionId && run.sessionId !== filter.sessionId) return false;
    if (filter?.playbookId && run.playbookId !== filter.playbookId) return false;
    return true;
  });
}

export async function updateControlledExecutionRun(
  id: string,
  patch: Partial<Pick<ControlledExecutionRunRecord, "state" | "currentStepId" | "error">>,
) {
  const timestamp = now();
  let updated: ControlledExecutionRunRecord | null = null;
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) =>
    current.map((raw) => {
      const run = normalizeRun(raw);
      if (!run || run.id !== id) return raw;
      updated = {
        ...run,
        ...patch,
        error: clipError(patch.error) ?? run.error,
        updatedAt: timestamp,
        finishedAt:
          patch.state === "completed" || patch.state === "failed" || patch.state === "cancelled"
            ? timestamp
            : run.finishedAt,
      };
      return updated;
    }),
  );
  return updated;
}

export async function updateControlledExecutionStep(
  executionId: string,
  stepId: string,
  patch: Partial<ControlledExecutionStepRecord>,
) {
  const timestamp = now();
  let updatedStep: ControlledExecutionStepRecord | null = null;
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) =>
    current.map((raw) => {
      const run = normalizeRun(raw);
      if (!run || run.id !== executionId) return raw;
      const steps = run.steps.map((step) => {
        if (step.stepId !== stepId) return step;
        updatedStep = normalizeStep({
          ...step,
          ...patch,
          error: clipError(patch.error) ?? step.error,
          startedAt:
            patch.state === "running" && !step.startedAt ? timestamp : patch.startedAt ?? step.startedAt,
          finishedAt:
            patch.state === "completed" || patch.state === "failed" || patch.state === "skipped"
              ? timestamp
              : patch.finishedAt ?? step.finishedAt,
        });
        return updatedStep;
      });
      return {
        ...run,
        steps,
        currentStepId: stepId,
        updatedAt: timestamp,
      };
    }),
  );
  return updatedStep;
}

export async function requestControlledApproval(executionId: string, stepId: string) {
  const timestamp = now();
  const approval: ControlledApprovalRecord = {
    executionId,
    stepId,
    state: "pending",
    requestedAt: timestamp,
  };
  await updateControlledExecutionRun(executionId, {
    state: "awaiting_approval",
    currentStepId: stepId,
  });
  await updateControlledExecutionStep(executionId, stepId, {
    state: "awaiting_approval",
    approval,
  });
  return approval;
}

export async function resolveControlledApproval(
  executionId: string,
  stepId: string,
  input: { approved: boolean; feedback?: string },
) {
  const timestamp = now();
  const approval: ControlledApprovalRecord = {
    executionId,
    stepId,
    state: input.approved ? "approved" : "rejected",
    requestedAt: timestamp,
    resolvedAt: timestamp,
    feedback: clipError(input.feedback),
    approver: "local_user",
  };
  await updateControlledExecutionStep(executionId, stepId, {
    approval,
  });
  if (!input.approved) {
    await updateControlledExecutionRun(executionId, {
      state: "failed",
      error: input.feedback || "User rejected step",
    });
  }
  return approval;
}
```

- [ ] **Step 5: Run store tests**

Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/executor/runtime/types.ts src/lib/server/controlled-execution-store.ts src/__tests__/lib/server/controlled-execution-store.test.ts
git commit -m "feat: add controlled execution store"
```

---

### Task 2: Make Approval Durable

**Files:**

- Modify: `src/lib/executor/approval-store.ts`
- Modify: `src/app/api/agent/approve/route.ts`
- Test: `src/__tests__/lib/executor/approval-store.test.ts`

- [ ] **Step 1: Add failing approval persistence test**

Append to `src/__tests__/lib/executor/approval-store.test.ts`:

```ts
it("persists approval decisions for controlled executions", async () => {
  const { createControlledExecutionRun, getControlledExecutionRun } = await import(
    "@/lib/server/controlled-execution-store"
  );
  const { waitForApproval, resolveApproval } = await import("@/lib/executor/approval-store");

  await createControlledExecutionRun({
    id: "exec-durable-approval",
    requestId: "req-durable-approval",
    sessionId: "session-1",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: "plan-approval",
      goal: "approval",
      totalSteps: 1,
      requiresApproval: true,
      steps: [
        {
          id: "human_review",
          title: "Review",
          description: "Review",
          mode: "review",
          dependsOn: [],
          toolCalls: [{ toolName: "human_ask" }],
        },
      ],
    },
  });

  const promise = waitForApproval("exec-durable-approval", "human_review", 1_000);
  await resolveApproval("exec-durable-approval", "human_review", false, "not ready");
  await expect(promise).resolves.toEqual({ approved: false, feedback: "not ready" });

  const run = await getControlledExecutionRun("exec-durable-approval");
  expect(run?.state).toBe("failed");
  expect(run?.steps[0]?.approval).toMatchObject({
    state: "rejected",
    feedback: "not ready",
  });
});
```

Add temp cwd setup to `approval-store.test.ts` by following the same pattern from `json-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "approval-store-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/approval-store.test.ts
```

Expected: FAIL because `resolveApproval` does not persist controlled approval decisions.

- [ ] **Step 3: Update approval store**

Modify `src/lib/executor/approval-store.ts`:

```ts
import {
  requestControlledApproval,
  resolveControlledApproval,
} from "@/lib/server/controlled-execution-store";

const pendingApprovals = new Map<
  string,
  { resolve: (v: { approved: boolean; feedback?: string }) => void }
>();

export async function resolveApproval(
  executionId: string,
  stepId: string,
  approved: boolean,
  feedback?: string,
) {
  await resolveControlledApproval(executionId, stepId, { approved, feedback }).catch(() => null);
  const key = `${executionId}:${stepId}`;
  const pending = pendingApprovals.get(key);
  if (pending) {
    pending.resolve({ approved, feedback });
    pendingApprovals.delete(key);
  }
}

export async function waitForApproval(
  executionId: string,
  stepId: string,
  timeoutMs = 300_000,
): Promise<{ approved: boolean; feedback?: string }> {
  await requestControlledApproval(executionId, stepId).catch(() => null);
  return new Promise((resolve) => {
    const key = `${executionId}:${stepId}`;
    pendingApprovals.set(key, { resolve });
    setTimeout(() => {
      if (pendingApprovals.has(key)) {
        pendingApprovals.delete(key);
        void resolveControlledApproval(executionId, stepId, {
          approved: false,
          feedback: "Approval timeout",
        }).catch(() => null);
        resolve({ approved: false, feedback: "Approval timeout" });
      }
    }, timeoutMs);
  });
}
```

- [ ] **Step 4: Update approve route to await persistence**

Modify `src/app/api/agent/approve/route.ts`:

```ts
  await resolveApproval(
    body.executionId,
    body.stepId,
    body.approved,
    typeof body.feedback === "string" ? body.feedback : undefined,
  );
```

- [ ] **Step 5: Run approval tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/approval-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run controlled runtime tests**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/executor/approval-store.ts src/app/api/agent/approve/route.ts src/__tests__/lib/executor/approval-store.test.ts
git commit -m "feat: persist controlled approvals"
```

---

### Task 3: Create Durable Controlled Runs From Core

**Files:**

- Modify: `src/lib/executor/core.ts`
- Test: `src/__tests__/lib/executor/controlled-runtime.test.ts`

- [ ] **Step 1: Add failing durable run creation test**

Append to `src/__tests__/lib/executor/controlled-runtime.test.ts`:

```ts
it("creates a durable controlled execution run before executing steps", async () => {
  const { getControlledExecutionRun } = await import("@/lib/server/controlled-execution-store");
  vi.stubGlobal("fetch", vi.fn());
  const request = buildRequest();
  const { callbacks } = buildCallbacks();

  const result = await runMultiStepTask(request, callbacks);
  const run = await getControlledExecutionRun(request.metadata.requestId);

  expect(result.ok).toBe(true);
  expect(run?.id).toBe(request.metadata.requestId);
  expect(run?.requestId).toBe(request.metadata.requestId);
  expect(run?.playbookId).toBe("sales-pipeline-v1");
  expect(run?.planId).toBe("playbook:sales-pipeline-v1:1.0.0");
});
```

Add temp cwd setup to the test file if it is not already present:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-runtime-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: FAIL because `runMultiStepTask` does not create a durable run.

- [ ] **Step 3: Create durable run in core**

Modify `src/lib/executor/core.ts`:

```ts
import { createControlledExecutionRun } from "@/lib/server/controlled-execution-store";
```

After selecting a valid controlled plan and before `executeMultiStep(...)`, add:

```ts
  if (controlledPlanResolution?.ok && normalizedRequest.controlledPlaybookId) {
    const playbook = getControlledPlaybook(normalizedRequest.controlledPlaybookId);
    if (playbook) {
      await createControlledExecutionRun({
        id: normalizedRequest.metadata.requestId,
        requestId: normalizedRequest.metadata.requestId,
        sessionId: normalizedRequest.session.id,
        workflowRunId:
          typeof normalizedRequest.context.workspace?.workflowRunId === "string"
            ? normalizedRequest.context.workspace.workflowRunId
            : undefined,
        scenarioId: playbook.scenarioId,
        playbookId: playbook.id,
        playbookVersion: playbook.version,
        plan,
      });
    }
  }
```

- [ ] **Step 4: Run controlled runtime test**

Run:

```bash
npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/core.ts src/__tests__/lib/executor/controlled-runtime.test.ts
git commit -m "feat: create durable controlled runs"
```

---

### Task 4: Add Step Input Builder

**Files:**

- Create: `src/lib/executor/runtime/step-input.ts`
- Test: `src/__tests__/lib/executor/runtime/step-input.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/lib/executor/runtime/step-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AgentCoreTaskRequest, StepResult } from "@/lib/executor/contracts";
import { buildControlledStepInput } from "@/lib/executor/runtime/step-input";

function makeRequest(): AgentCoreTaskRequest {
  return {
    taskInput: { userMessage: "Lead from website" },
    session: { id: "session-1" },
    metadata: { requestId: "req-1", source: "test" },
    context: {
      systemPrompt: "",
      workspace: { workflowRunId: "workflow-1", activeScenarioId: "sales-pipeline" },
    },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {
      timeoutSeconds: 30,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
  };
}

describe("buildControlledStepInput", () => {
  it("combines request context, step metadata, and previous outputs", () => {
    const previousResults: StepResult[] = [
      {
        stepId: "intake",
        status: "completed",
        output: { normalizedLead: { company: "ACME" } },
        toolCallResults: [],
        tokensUsed: 0,
        durationMs: 1,
      },
    ];

    const input = buildControlledStepInput({
      request: makeRequest(),
      step: {
        id: "qualify",
        title: "Qualify",
        description: "Qualify lead",
        mode: "assist",
        dependsOn: ["intake"],
        toolCalls: [{ toolName: "llm_generate" }],
      },
      stepIndex: 1,
      previousResults,
    });

    expect(input).toMatchObject({
      request: {
        message: "Lead from website",
        sessionId: "session-1",
        requestId: "req-1",
      },
      workflow: {
        workflowRunId: "workflow-1",
        activeScenarioId: "sales-pipeline",
      },
      step: {
        id: "qualify",
        index: 1,
        dependsOn: ["intake"],
      },
      previousOutputs: {
        intake: { normalizedLead: { company: "ACME" } },
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/step-input.test.ts
```

Expected: FAIL because `step-input.ts` does not exist.

- [ ] **Step 3: Implement step input builder**

Create `src/lib/executor/runtime/step-input.ts`:

```ts
import type { AgentCoreTaskRequest, ExecutionStep, StepResult } from "@/lib/executor/contracts";

function pickWorkflowContext(workspace?: Record<string, unknown> | null) {
  return {
    workflowRunId: typeof workspace?.workflowRunId === "string" ? workspace.workflowRunId : undefined,
    activeScenarioId:
      typeof workspace?.activeScenarioId === "string" ? workspace.activeScenarioId : undefined,
  };
}

export function buildControlledStepInput(input: {
  request: AgentCoreTaskRequest;
  step: ExecutionStep;
  stepIndex: number;
  previousResults: StepResult[];
}) {
  const previousOutputs = Object.fromEntries(
    input.previousResults
      .filter((result) => result.status === "completed")
      .map((result) => [result.stepId, result.output]),
  );

  return {
    request: {
      message: input.request.taskInput.userMessage,
      sessionId: input.request.session.id,
      requestId: input.request.metadata.requestId,
      source: input.request.metadata.source,
    },
    workflow: pickWorkflowContext(input.request.context.workspace),
    step: {
      id: input.step.id,
      title: input.step.title,
      description: input.step.description,
      mode: input.step.mode,
      dependsOn: input.step.dependsOn,
      index: input.stepIndex,
    },
    previousOutputs,
  };
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/step-input.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/step-input.ts src/__tests__/lib/executor/runtime/step-input.test.ts
git commit -m "feat: build controlled step inputs"
```

---

### Task 5: Add Controlled Output Schema Validator

**Files:**

- Create: `src/lib/executor/runtime/schema.ts`
- Test: `src/__tests__/lib/executor/runtime/schema.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `src/__tests__/lib/executor/runtime/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateControlledOutput } from "@/lib/executor/runtime/schema";

describe("validateControlledOutput", () => {
  const schema = {
    type: "object" as const,
    required: ["summary", "priority"],
    properties: {
      summary: { type: "string" },
      priority: { enum: ["high", "medium", "low"] },
      risks: { type: "array", items: { type: "string" } },
    },
    additionalProperties: false,
  };

  it("accepts output matching the schema subset", () => {
    const result = validateControlledOutput(
      { summary: "qualified", priority: "high", risks: ["budget unknown"] },
      schema,
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects missing required fields", () => {
    const result = validateControlledOutput({ summary: "qualified" }, schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: priority");
  });

  it("rejects wrong primitive types and enum values", () => {
    const result = validateControlledOutput(
      { summary: 123, priority: "urgent", risks: ["x"] },
      schema,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field summary must be string");
    expect(result.errors).toContain("Field priority must be one of high, medium, low");
  });

  it("rejects additional properties when disabled", () => {
    const result = validateControlledOutput(
      { summary: "qualified", priority: "low", extra: true },
      schema,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unexpected field: extra");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/schema.test.ts
```

Expected: FAIL because `schema.ts` does not exist.

- [ ] **Step 3: Implement schema validator**

Create `src/lib/executor/runtime/schema.ts`:

```ts
import type { ControlledPlaybookSchema } from "@/lib/executor/playbooks/types";

export type ControlledOutputValidationResult = {
  valid: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function typeName(value: unknown) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateField(name: string, value: unknown, schema: Record<string, unknown>) {
  const errors: string[] = [];
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push(`Field ${name} must be one of ${schema.enum.join(", ")}`);
    }
    return errors;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`Field ${name} must be array`);
      return errors;
    }
    const itemSchema = isRecord(schema.items) ? schema.items : null;
    if (itemSchema?.type) {
      value.forEach((item, index) => {
        if (typeName(item) !== itemSchema.type) {
          errors.push(`Field ${name}[${index}] must be ${itemSchema.type}`);
        }
      });
    }
    return errors;
  }

  if (schema.type && typeName(value) !== schema.type) {
    errors.push(`Field ${name} must be ${schema.type}`);
  }
  return errors;
}

export function validateControlledOutput(
  output: unknown,
  schema: ControlledPlaybookSchema,
): ControlledOutputValidationResult {
  const errors: string[] = [];
  if (!isRecord(output)) {
    return { valid: false, errors: ["Output must be an object"] };
  }

  for (const field of schema.required ?? []) {
    if (!(field in output)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  const properties = schema.properties ?? {};
  for (const [field, value] of Object.entries(output)) {
    const fieldSchema = properties[field];
    if (!fieldSchema) {
      if (schema.additionalProperties === false) {
        errors.push(`Unexpected field: ${field}`);
      }
      continue;
    }
    if (fieldSchema && typeof fieldSchema === "object") {
      errors.push(...validateField(field, value, fieldSchema as Record<string, unknown>));
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run schema tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/schema.ts src/__tests__/lib/executor/runtime/schema.test.ts
git commit -m "feat: validate controlled step outputs"
```

---

### Task 6: Persist Step Trace And Validate Outputs During Execution

**Files:**

- Modify: `src/lib/executor/step-executor.ts`
- Modify: `src/lib/executor/contracts.ts`
- Modify: `src/lib/executor/playbooks/resolver.ts`
- Test: `src/__tests__/lib/executor/step-executor.test.ts`

- [ ] **Step 1: Add failing schema integration test**

Append to `src/__tests__/lib/executor/step-executor.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts
```

Expected: FAIL because step outputs are not schema validated.

- [ ] **Step 3: Extend execution step metadata**

Modify `src/lib/executor/contracts.ts`:

```ts
export type ExecutionStep = {
  id: string;
  title: string;
  description: string;
  toolCalls: ToolCallSpec[];
  dependsOn: string[];
  mode: "auto" | "assist" | "review" | "manual";
  estimatedTokens?: number;
  outputSchema?: Record<string, unknown>;
  onFailure?: {
    action: "retry" | "await_human" | "fail_run";
    maxRetries?: number;
  };
};
```

Modify `src/lib/executor/playbooks/resolver.ts` so resolved steps carry schema and failure policy:

```ts
    outputSchema: step.outputSchema,
    onFailure: step.onFailure,
```

- [ ] **Step 4: Update step executor**

Modify `src/lib/executor/step-executor.ts`:

```ts
import { buildControlledStepInput } from "@/lib/executor/runtime/step-input";
import { validateControlledOutput } from "@/lib/executor/runtime/schema";
import {
  updateControlledExecutionRun,
  updateControlledExecutionStep,
} from "@/lib/server/controlled-execution-store";
```

Inside the step loop, before execution:

```ts
    const stepInput = buildControlledStepInput({
      request,
      step,
      stepIndex: i,
      previousResults: trace.stepResults,
    });
    await updateControlledExecutionRun(reqId, { state: "running", currentStepId: step.id }).catch(
      () => null,
    );
    await updateControlledExecutionStep(reqId, step.id, {
      state: "running",
      input: stepInput,
    }).catch(() => null);
```

After `executeSingleStep(...)`, before pushing result:

```ts
    if (result.status === "completed" && step.outputSchema) {
      const validation = validateControlledOutput(result.output, step.outputSchema as any);
      await updateControlledExecutionStep(reqId, step.id, {
        schemaValidation: { ...validation, checkedAt: Date.now() },
      }).catch(() => null);
      if (!validation.valid) {
        result.status = "failed";
        result.error = validation.errors.join("; ");
      }
    }
```

After pushing result:

```ts
    await updateControlledExecutionStep(reqId, step.id, {
      state: result.status,
      output: result.output,
      error: result.error,
      toolCallResults: result.toolCallResults,
    }).catch(() => null);
```

At finalization:

```ts
  await updateControlledExecutionRun(reqId, {
    state: trace.success ? "completed" : "failed",
    error: trace.error,
  }).catch(() => null);
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/executor/contracts.ts src/lib/executor/playbooks/resolver.ts src/lib/executor/step-executor.ts src/__tests__/lib/executor/step-executor.test.ts
git commit -m "feat: persist controlled step traces"
```

---

### Task 7: Apply Failure Policy And Retry

**Files:**

- Modify: `src/lib/executor/step-executor.ts`
- Test: `src/__tests__/lib/executor/step-executor.test.ts`

- [ ] **Step 1: Add failing retry policy test**

Append to `src/__tests__/lib/executor/step-executor.test.ts`:

```ts
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
```

- [ ] **Step 2: Add failing fail_run test**

Append:

```ts
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
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts
```

Expected: FAIL because retry and fail_run are not applied.

- [ ] **Step 4: Implement retry/fail_run loop**

In `src/lib/executor/step-executor.ts`, wrap `executeSingleStep(...)` in a retry loop:

```ts
    const maxRetries =
      step.onFailure?.action === "retry" ? Math.max(0, step.onFailure.maxRetries ?? 0) : 0;
    let result: StepResult | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      result = await executeSingleStep(step, request, callbacks, config, abortController.signal);
      if (result.status === "completed") break;
      await updateControlledExecutionStep(reqId, step.id, {
        attempts: attempt + 1,
        error: result.error,
        toolCallResults: result.toolCallResults,
      }).catch(() => null);
    }
```

After a failed result:

```ts
    if (result.status === "failed" && step.onFailure?.action === "fail_run") {
      trace.stepResults.push(result);
      callbacks.onStepComplete(result);
      callbacks.onError(result.error ?? "Step failed");
      break;
    }
```

For `await_human`, keep it as failure for now but make the error explicit:

```ts
    if (result.status === "failed" && step.onFailure?.action === "await_human") {
      result.error = result.error ?? "Step failed and requires human intervention";
    }
```

- [ ] **Step 5: Run step executor tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/step-executor.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/executor/step-executor.ts src/__tests__/lib/executor/step-executor.test.ts
git commit -m "feat: apply controlled failure policy"
```

---

### Task 8: Add Controlled Run Query Route

**Files:**

- Create: `src/app/api/runtime/executor/controlled-runs/[runId]/route.ts`
- Test: `src/__tests__/app/api/controlled-run-route.test.ts`

- [ ] **Step 1: Write failing route test**

Create `src/__tests__/app/api/controlled-run-route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GET } from "@/app/api/runtime/executor/controlled-runs/[runId]/route";
import { createControlledExecutionRun } from "@/lib/server/controlled-execution-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-run-route-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("controlled run route", () => {
  it("returns a controlled execution run by id", async () => {
    await createControlledExecutionRun({
      id: "exec-route-1",
      requestId: "req-route-1",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-route",
        goal: "route",
        totalSteps: 0,
        requiresApproval: false,
        steps: [],
      },
    });

    const response = await GET(new Request("http://localhost/api/runtime/executor/controlled-runs/exec-route-1"), {
      params: Promise.resolve({ runId: "exec-route-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.run.id).toBe("exec-route-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement route**

Create `src/app/api/runtime/executor/controlled-runs/[runId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { getControlledExecutionRun } from "@/lib/server/controlled-execution-store";

export async function GET(
  req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  const { runId } = await context.params;
  const run = await getControlledExecutionRun(runId);
  if (!run) {
    return NextResponse.json({ ok: false, error: "Controlled run not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { run } });
}
```

- [ ] **Step 4: Run route test**

Run:

```bash
npm test -- src/__tests__/app/api/controlled-run-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/runtime/executor/controlled-runs/[runId]/route.ts src/__tests__/app/api/controlled-run-route.test.ts
git commit -m "feat: expose controlled run trace route"
```

---

### Task 9: Add Minimal Writeback Receipts

**Files:**

- Create: `src/lib/executor/runtime/writeback.ts`
- Modify: `src/lib/executor/step-executor.ts`
- Test: `src/__tests__/lib/executor/controlled-runtime.test.ts`

- [ ] **Step 1: Write failing writeback receipt test**

Append to `src/__tests__/lib/executor/controlled-runtime.test.ts`:

```ts
it("records writeback receipts for controlled steps with writesTo targets", async () => {
  vi.stubGlobal("fetch", vi.fn());
  const { getControlledExecutionRun } = await import("@/lib/server/controlled-execution-store");
  const request = buildRequest();
  const { callbacks } = buildCallbacks();

  const result = await runMultiStepTask(request, callbacks);
  const run = await getControlledExecutionRun(request.metadata.requestId);
  const intake = run?.steps.find((step) => step.stepId === "intake");

  expect(result.ok).toBe(true);
  expect(intake?.writebackReceipts.length).toBeGreaterThan(0);
  expect(intake?.writebackReceipts[0]).toMatchObject({
    target: "workflow_run",
    ok: true,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: FAIL because writeback receipts are not recorded.

- [ ] **Step 3: Implement writeback helper**

Create `src/lib/executor/runtime/writeback.ts`:

```ts
import type { ControlledPlaybookStep } from "@/lib/executor/playbooks/types";
import type { ControlledWritebackReceipt } from "@/lib/executor/runtime/types";

export function buildWritebackReceipts(input: {
  step: ControlledPlaybookStep | null;
  approved: boolean;
}): ControlledWritebackReceipt[] {
  if (!input.step?.writesTo) return [];
  const writtenAt = Date.now();
  return input.step.writesTo.map((target) => {
    const requiresApproval = target.when === "after_approval";
    if (requiresApproval && !input.approved) {
      return {
        target: target.target,
        ok: false,
        summary: "Skipped because output is not approved",
        writtenAt,
      };
    }
    return {
      target: target.target,
      ok: true,
      summary: `Accepted writeback target ${target.target}`,
      writtenAt,
    };
  });
}
```

- [ ] **Step 4: Persist writeback receipts in step executor**

In `src/lib/executor/step-executor.ts`, import playbook lookup and helper:

```ts
import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import { buildWritebackReceipts } from "@/lib/executor/runtime/writeback";
```

Before updating a completed step, resolve the playbook step:

```ts
    const controlledStepContract = request.controlledPlaybookId
      ? getControlledPlaybook(request.controlledPlaybookId)?.steps.find(
          (playbookStep) => playbookStep.id === step.id,
        ) ?? null
      : null;
    const writebackReceipts =
      result.status === "completed"
        ? buildWritebackReceipts({
            step: controlledStepContract,
            approved: step.mode !== "review" && step.mode !== "manual",
          })
        : [];
```

Include `writebackReceipts` in `updateControlledExecutionStep(...)`.

- [ ] **Step 5: Run controlled runtime test**

Run:

```bash
npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/executor/runtime/writeback.ts src/lib/executor/step-executor.ts src/__tests__/lib/executor/controlled-runtime.test.ts
git commit -m "feat: record controlled writeback receipts"
```

---

### Task 10: Extend Stream Events With Durable Run Metadata

**Files:**

- Modify: `src/app/api/agent/stream/route.ts`
- Modify: `src/__tests__/app/api/agent-stream-route.test.ts`

- [ ] **Step 1: Add failing route test**

Append to `src/__tests__/app/api/agent-stream-route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/app/api/agent-stream-route.test.ts
```

Expected: FAIL because stream events do not include durable metadata.

- [ ] **Step 3: Preserve workflowRunId in normalized context**

Modify `src/app/api/agent/stream/route.ts` when normalizing request:

```ts
    workspaceContext: {
      workflowRunId: typeof body.workflowRunId === "string" ? body.workflowRunId : undefined,
      scenarioId: typeof body.scenarioId === "string" ? body.scenarioId : undefined,
    },
```

Add common metadata:

```ts
  const workflowRunId = typeof body.workflowRunId === "string" ? body.workflowRunId : undefined;
  const streamMeta = {
    executionId,
    requestId: normalized.metadata.requestId,
    playbookId: normalized.controlledPlaybookId,
    workflowRunId,
  };
```

Use `streamMeta` in streamed payloads:

```ts
send("execution_done", {
  ...streamMeta,
  ok: result.ok,
  ...
});
```

- [ ] **Step 4: Run route test**

Run:

```bash
npm test -- src/__tests__/app/api/agent-stream-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/agent/stream/route.ts src/__tests__/app/api/agent-stream-route.test.ts
git commit -m "feat: stream controlled run metadata"
```

---

### Task 11: Extend Regression Gate And Final Verification

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add new tests to controlled runtime script**

Modify `package.json`:

```json
"test:controlled-runtime": "vitest run src/__tests__/lib/executor/playbooks/sales-pipeline.test.ts src/__tests__/lib/executor/playbooks/validator.test.ts src/__tests__/lib/executor/runtime/schema.test.ts src/__tests__/lib/executor/runtime/step-input.test.ts src/__tests__/lib/server/controlled-execution-store.test.ts src/__tests__/lib/executor/approval-store.test.ts src/__tests__/lib/executor/controlled-runtime.test.ts src/__tests__/lib/executor/step-executor.test.ts src/__tests__/lib/executor/run-workflow-multi-step.test.ts src/__tests__/app/api/agent-stream-route.test.ts src/__tests__/app/api/controlled-run-route.test.ts src/__tests__/hooks/useMultiStepStream.test.tsx"
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
git commit -m "test: expand controlled runtime gate"
```

---

## Self-Review Checklist

- Every task starts with a failing test.
- Durable state uses existing `json-store`; no new database dependency.
- `/api/agent/stream` and `/api/agent/approve` remain compatible with existing callers.
- Controlled approval durable state is authoritative; in-memory waiters are an optimization.
- Schema-invalid output fails before writeback.
- Failure policies do not silently continue dependent steps.
- The final gate includes `test:controlled-runtime`, `test:core-workflows`, `lint`, and `build`.
