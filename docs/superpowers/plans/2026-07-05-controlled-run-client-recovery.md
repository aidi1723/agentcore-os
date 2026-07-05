# Controlled Run Client Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the existing multi-step client continue a durable controlled run after approval or stream loss by calling the controlled run resume endpoint.

**Architecture:** Extend `useMultiStepStream` with a client-side durable run projection and `resume()` function, then make `approve(true)` continue through the resume route. Keep `MultiStepPanel` compact by adding only a `resuming` status badge and a gated `继续执行` secondary button.

**Tech Stack:** Next.js App Router, React 19 hooks, TypeScript, Vitest, Testing Library `renderHook`, existing controlled runtime API routes.

---

## File Structure

Modify:

- `src/__tests__/hooks/useMultiStepStream.test.tsx`
  - Add response helpers for stream and JSON route mocks.
  - Add TDD coverage for approval-driven resume, manual resume, conflicts, missing run id, and rejection.
- `src/hooks/useMultiStepStream.ts`
  - Add `resuming` status.
  - Import durable controlled run types.
  - Add durable run projection helpers.
  - Add `resume(runId?: string)`.
  - Update `approve()` to validate HTTP responses and call `resume()` only after approval.
- `src/components/MultiStepPanel.tsx`
  - Add the `resuming` badge label.
  - Read `resume` and `canResume` from the hook.
  - Add the compact `继续执行` button only for recoverable states.

Do not modify backend routes in this plan.

---

### Task 1: Add Hook Tests For Approval-Driven Resume

**Files:**

- Modify: `src/__tests__/hooks/useMultiStepStream.test.tsx`

- [ ] **Step 1: Add test helpers and cleanup**

Modify the imports and helper area at the top of `src/__tests__/hooks/useMultiStepStream.test.tsx`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMultiStepStream } from "@/hooks/useMultiStepStream";

function mockStreamResponse(payload: string, executionId = "exec-1") {
  const reader = {
    read: vi.fn()
      .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(payload) })
      .mockResolvedValueOnce({ done: true, value: undefined }),
  };

  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name === "X-Execution-Id" ? executionId : null),
    },
    body: {
      getReader: () => reader,
    },
  };
}

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    requestId: "exec-1",
    sessionId: "webos-spotlight",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-1",
    state: "completed",
    currentStepId: "review",
    createdAt: 1,
    updatedAt: 2,
    plan: {
      id: "plan-1",
      goal: "controlled client recovery",
      totalSteps: 2,
      requiresApproval: true,
      steps: [
        {
          id: "review",
          title: "Review",
          description: "Review the generated draft",
          mode: "review",
          dependsOn: [],
          toolCalls: [],
        },
        {
          id: "writeback",
          title: "Writeback",
          description: "Persist approved output",
          mode: "manual",
          dependsOn: ["review"],
          toolCalls: [],
        },
      ],
    },
    steps: [
      {
        stepId: "review",
        state: "completed",
        startedAt: 1,
        finishedAt: 11,
        input: null,
        output: { approved: true },
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [],
      },
      {
        stepId: "writeback",
        state: "completed",
        startedAt: 12,
        finishedAt: 20,
        input: null,
        output: { written: true },
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
```

- [ ] **Step 2: Add a failing test for approve(true) followed by resume**

Add this test inside `describe("useMultiStepStream", () => { ... })`:

```ts
it("continues a durable run after approval by calling the resume route", async () => {
  const payload = [
    "event: plan_ready\n",
    `data: ${JSON.stringify({ plan: makeRun().plan })}\n`,
    "\n",
    "event: approval_needed\n",
    `data: ${JSON.stringify({
      executionId: "exec-1",
      stepId: "review",
      title: "Review",
      description: "Approve generated draft",
      mode: "review",
    })}\n`,
    "\n",
    "event: execution_done\n",
    `data: ${JSON.stringify({ ok: false, error: "Awaiting approval for review" })}\n`,
    "\n",
  ].join("");

  const fetchMock = vi.fn()
    .mockResolvedValueOnce(mockStreamResponse(payload))
    .mockResolvedValueOnce(mockJsonResponse({ ok: true }))
    .mockResolvedValueOnce(mockJsonResponse({
      ok: true,
      data: {
        runId: "exec-1",
        state: "completed",
        resumedStepIds: ["review", "writeback"],
        run: makeRun(),
      },
    }));
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useMultiStepStream());

  await act(async () => {
    await result.current.start("Run controlled workflow");
  });

  expect(result.current.status).toBe("awaiting_approval");
  expect(result.current.approvalRequest?.stepId).toBe("review");

  await act(async () => {
    await result.current.approve(true);
  });

  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining("/api/agent/approve"),
    expect.objectContaining({ method: "POST" }),
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
    expect.objectContaining({ method: "POST" }),
  );
  expect(result.current.status).toBe("done");
  expect(result.current.approvalRequest).toBeNull();
  expect(result.current.stepResults.map((step) => step.stepId)).toEqual(["review", "writeback"]);
});
```

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```bash
npm test -- src/__tests__/hooks/useMultiStepStream.test.tsx
```

Expected: FAIL because `approve(true)` does not call the resume route and the hook has no durable run projection.

- [ ] **Step 4: Commit the failing test**

```bash
git add src/__tests__/hooks/useMultiStepStream.test.tsx
git commit -m "test: cover controlled run client resume after approval"
```

---

### Task 2: Implement Durable Run Projection And Resume In The Hook

**Files:**

- Modify: `src/hooks/useMultiStepStream.ts`
- Test: `src/__tests__/hooks/useMultiStepStream.test.tsx`

- [ ] **Step 1: Add imports, status, and helper types**

In `src/hooks/useMultiStepStream.ts`, update the type imports and status type:

```ts
import type { ExecutionPlan, ExecutionStep, StepResult } from "@/lib/executor/contracts";
import type {
  ControlledApprovalRecord,
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
} from "@/lib/executor/runtime/types";

export type MultiStepStatus =
  | "idle"
  | "connecting"
  | "running"
  | "resuming"
  | "awaiting_approval"
  | "done"
  | "error";
```

Add these response types below `MultiStepStreamState`:

```ts
type ResumeResponse =
  | {
      ok: true;
      data: {
        runId: string;
        state: ControlledExecutionRunRecord["state"];
        resumedStepIds: string[];
        run: ControlledExecutionRunRecord;
      };
    }
  | {
      ok: false;
      error: string;
      data?: {
        runId?: string;
        state?: ControlledExecutionRunRecord["state"];
        currentStepId?: string;
      };
    };
```

- [ ] **Step 2: Add projection helpers**

Add these helpers above `export function useMultiStepStream()`:

```ts
function stepDurationMs(step: ControlledExecutionStepRecord) {
  if (typeof step.startedAt === "number" && typeof step.finishedAt === "number") {
    return Math.max(0, step.finishedAt - step.startedAt);
  }
  return 0;
}

function durableStepToResult(step: ControlledExecutionStepRecord): StepResult | null {
  if (step.state !== "completed" && step.state !== "skipped" && step.state !== "failed") {
    return null;
  }
  return {
    stepId: step.stepId,
    status: step.state,
    output: step.output ?? null,
    toolCallResults: step.toolCallResults ?? [],
    tokensUsed: (step.toolCallResults ?? []).reduce((sum, item) => sum + (item.tokensUsed ?? 0), 0),
    durationMs: stepDurationMs(step),
    error: step.error,
  };
}

function approvalToRequest(
  run: ControlledExecutionRunRecord,
  step: ControlledExecutionStepRecord,
  approval: ControlledApprovalRecord,
): ApprovalRequest {
  const planStep = run.plan.steps.find((item) => item.id === step.stepId);
  return {
    executionId: run.id,
    stepId: step.stepId,
    title: planStep?.title ?? step.stepId,
    description: planStep?.description,
    mode: planStep?.mode,
  };
}

function projectRunState(run: ControlledExecutionRunRecord): MultiStepStreamState {
  const approvalStep = run.steps.find(
    (step) => step.state === "awaiting_approval" && step.approval?.state === "pending",
  );
  const approvalRequest = approvalStep?.approval
    ? approvalToRequest(run, approvalStep, approvalStep.approval)
    : null;
  const stepResults = run.steps
    .map(durableStepToResult)
    .filter((item): item is StepResult => Boolean(item));
  const error = run.state === "failed" || run.state === "cancelled" ? run.error ?? "Controlled run failed" : null;
  const status: MultiStepStatus =
    run.state === "completed"
      ? "done"
      : run.state === "failed" || run.state === "cancelled"
        ? "error"
        : run.state === "awaiting_approval"
          ? "awaiting_approval"
          : "running";

  return {
    status,
    executionId: run.id,
    plan: run.plan,
    currentStepId: run.currentStepId ?? null,
    stepResults,
    approvalRequest,
    error,
  };
}
```

- [ ] **Step 3: Add the resume callback**

Inside `useMultiStepStream`, after `handleEvent`, add:

```ts
  const resume = useCallback(async (runId?: string) => {
    const targetRunId = runId ?? state.executionId;
    if (!targetRunId) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Cannot resume controlled run without an execution id",
      }));
      return;
    }

    setState((s) => ({ ...s, status: "resuming", error: null }));

    try {
      const res = await fetch(
        buildAgentCoreApiUrl(`/api/runtime/executor/controlled-runs/${encodeURIComponent(targetRunId)}/resume`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = (await res.json()) as ResumeResponse;
      if (res.ok && data.ok) {
        setState(projectRunState(data.data.run));
        return;
      }

      const error = data.ok === false ? data.error : `Resume failed: HTTP ${res.status}`;
      setState((s) => ({
        ...s,
        status:
          data.ok === false && data.data?.state === "awaiting_approval"
            ? "awaiting_approval"
            : data.ok === false && data.data?.state === "completed"
              ? "done"
              : "error",
        currentStepId: data.ok === false ? data.data?.currentStepId ?? s.currentStepId : s.currentStepId,
        error,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Resume failed",
      }));
    }
  }, [state.executionId]);
```

- [ ] **Step 4: Update approve to call resume only after approval**

Replace the current `approve` callback with:

```ts
  const approve = useCallback(async (approved: boolean, feedback?: string) => {
    const { executionId, approvalRequest } = state;
    if (!executionId || !approvalRequest) return;

    const res = await fetch(buildAgentCoreApiUrl("/api/agent/approve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        executionId,
        stepId: approvalRequest.stepId,
        approved,
        feedback,
      }),
    });

    if (!res.ok) {
      setState((s) => ({ ...s, status: "error", error: `Approval failed: HTTP ${res.status}` }));
      return;
    }

    if (!approved) {
      setState((s) => ({
        ...s,
        status: "error",
        approvalRequest: null,
        error: feedback ?? "User rejected step",
      }));
      return;
    }

    setState((s) => ({ ...s, approvalRequest: null }));
    await resume(executionId);
  }, [resume, state]);
```

- [ ] **Step 5: Add canResume and return resume**

Before the final return, add:

```ts
  const canResume =
    Boolean(state.executionId) &&
    state.status !== "resuming" &&
    (state.status === "error" || (state.status === "awaiting_approval" && !state.approvalRequest));

  return { ...state, start, approve, resume, stop, canResume };
```

Remove the previous `return { ...state, start, approve, stop };`.

- [ ] **Step 6: Run the focused hook test**

Run:

```bash
npm test -- src/__tests__/hooks/useMultiStepStream.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/hooks/useMultiStepStream.ts src/__tests__/hooks/useMultiStepStream.test.tsx
git commit -m "feat: resume controlled runs from client hook"
```

---

### Task 3: Cover Conflict, Rejection, Missing Id, And Manual Resume

**Files:**

- Modify: `src/__tests__/hooks/useMultiStepStream.test.tsx`
- Modify: `src/hooks/useMultiStepStream.ts`

- [ ] **Step 1: Add conflict and manual resume tests**

Add these tests inside the hook test `describe`:

```ts
it("keeps awaiting approval when resume returns an approval conflict", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(mockJsonResponse({
    ok: false,
    error: "Controlled run is awaiting approval",
    data: {
      runId: "exec-1",
      state: "awaiting_approval",
      currentStepId: "writeback",
    },
  }, 409));
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useMultiStepStream());

  await act(async () => {
    await result.current.resume("exec-1");
  });

  expect(result.current.status).toBe("awaiting_approval");
  expect(result.current.currentStepId).toBe("writeback");
  expect(result.current.error).toBe("Controlled run is awaiting approval");
});

it("reports an error when resume is called without an execution id", async () => {
  vi.stubGlobal("fetch", vi.fn());

  const { result } = renderHook(() => useMultiStepStream());

  await act(async () => {
    await result.current.resume();
  });

  expect(fetch).not.toHaveBeenCalled();
  expect(result.current.status).toBe("error");
  expect(result.current.error).toBe("Cannot resume controlled run without an execution id");
});

it("does not resume after approval rejection", async () => {
  const payload = [
    "event: approval_needed\n",
    `data: ${JSON.stringify({
      executionId: "exec-1",
      stepId: "review",
      title: "Review",
      mode: "review",
    })}\n`,
    "\n",
    "event: execution_done\n",
    `data: ${JSON.stringify({ ok: false, error: "Awaiting approval for review" })}\n`,
    "\n",
  ].join("");

  const fetchMock = vi.fn()
    .mockResolvedValueOnce(mockStreamResponse(payload))
    .mockResolvedValueOnce(mockJsonResponse({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useMultiStepStream());

  await act(async () => {
    await result.current.start("Run controlled workflow");
  });
  await act(async () => {
    await result.current.approve(false, "用户拒绝");
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.status).toBe("error");
  expect(result.current.error).toBe("用户拒绝");
});

it("allows manual resume after a stream error when a run id is known", async () => {
  const payload = [
    "event: step_complete\n",
    `data: ${JSON.stringify({
      stepId: "review",
      status: "completed",
      durationMs: 1,
      tokensUsed: 0,
      toolCallResults: [],
    })}\n`,
    "\n",
  ].join("");

  const fetchMock = vi.fn()
    .mockResolvedValueOnce(mockStreamResponse(payload))
    .mockResolvedValueOnce(mockJsonResponse({
      ok: true,
      data: {
        runId: "exec-1",
        state: "completed",
        resumedStepIds: ["writeback"],
        run: makeRun(),
      },
    }));
  vi.stubGlobal("fetch", fetchMock);

  const { result } = renderHook(() => useMultiStepStream());

  await act(async () => {
    await result.current.start("Run controlled workflow");
  });
  expect(result.current.status).toBe("error");
  expect(result.current.canResume).toBe(true);

  await act(async () => {
    await result.current.resume();
  });

  expect(fetchMock).toHaveBeenLastCalledWith(
    expect.stringContaining("/api/runtime/executor/controlled-runs/exec-1/resume"),
    expect.objectContaining({ method: "POST" }),
  );
  expect(result.current.status).toBe("done");
});
```

- [ ] **Step 2: Run the focused tests**

Run:

```bash
npm test -- src/__tests__/hooks/useMultiStepStream.test.tsx
```

Expected: PASS. If the conflict test leaves `status: "error"`, update the `resume` conflict mapping in `src/hooks/useMultiStepStream.ts` exactly as specified in Task 2 Step 3.

- [ ] **Step 3: Commit the expanded coverage**

```bash
git add src/__tests__/hooks/useMultiStepStream.test.tsx src/hooks/useMultiStepStream.ts
git commit -m "test: cover controlled run client recovery edges"
```

---

### Task 4: Add The Panel Resume UI

**Files:**

- Modify: `src/components/MultiStepPanel.tsx`
- Test indirectly through TypeScript, lint, and build.

- [ ] **Step 1: Add `resuming` to the status badge**

Update the `StatusBadge` map:

```ts
const map: Record<MultiStepStatus, { label: string; color: string }> = {
  idle: { label: "就绪", color: "bg-gray-100 text-gray-600" },
  connecting: { label: "连接中", color: "bg-yellow-100 text-yellow-700" },
  running: { label: "执行中", color: "bg-blue-100 text-blue-700" },
  resuming: { label: "恢复中", color: "bg-cyan-100 text-cyan-700" },
  awaiting_approval: { label: "等待审批", color: "bg-orange-100 text-orange-700" },
  done: { label: "完成", color: "bg-green-100 text-green-700" },
  error: { label: "错误", color: "bg-red-100 text-red-700" },
};
```

- [ ] **Step 2: Read resume state from the hook**

Update the hook destructuring:

```ts
const {
  status,
  plan,
  currentStepId,
  stepResults,
  approvalRequest,
  error,
  start,
  approve,
  resume,
  stop,
  canResume,
} = useMultiStepStream();
```

- [ ] **Step 3: Add the gated resume button**

Add this button block after the error paragraph and before the stop button:

```tsx
{canResume && (
  <button
    onClick={() => resume()}
    className="self-end px-3 py-1 rounded text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100"
  >
    继续执行
  </button>
)}
```

- [ ] **Step 4: Run the focused hook tests**

Run:

```bash
npm test -- src/__tests__/hooks/useMultiStepStream.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: exit 0. The existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` may still appear.

- [ ] **Step 6: Commit the panel UI**

```bash
git add src/components/MultiStepPanel.tsx
git commit -m "feat: expose controlled run resume action"
```

---

### Task 5: Final Verification

**Files:**

- Source files are already handled in earlier tasks.

- [ ] **Step 1: Run controlled runtime tests**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS.

- [ ] **Step 2: Run core workflow regression**

Run:

```bash
npm run test:core-workflows
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit 0. Existing `<img>` warning may appear.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: exit 0. Existing `<img>` warning may appear.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: only intentional changes are committed. Existing unrelated untracked files may remain:

```text
?? .playwright-cli/
?? .superpowers/
?? AGENTS.md
?? DESIGN.md
?? HEARTBEAT.md
?? IDENTITY.md
?? SOUL.md
?? TOOLS.md
?? USER.md
?? docs/superpowers/plans/2026-05-04-claw-code-executor-redesign.md
?? docs/superpowers/plans/2026-05-23-project-hardening-optimization.md
?? docs/superpowers/specs/2026-05-04-claw-code-executor-redesign.md
?? output/
?? scripts/seo/
```

- [ ] **Step 6: Commit any verification-only plan checklist updates**

If the implementation process marks this plan's checkboxes, commit those documentation updates separately:

```bash
git add docs/superpowers/plans/2026-07-05-controlled-run-client-recovery.md
git commit -m "docs: track controlled run client recovery execution"
```

---

## Self-Review

Spec coverage:

- Approval-driven resume is covered by Task 1 and Task 2.
- Manual resume after stream loss is covered by Task 3 and Task 4.
- Durable run projection is covered by Task 2.
- Conflict handling is covered by Task 3.
- Rejection handling is covered by Task 3.
- UI scope remains limited to the existing multi-step panel in Task 4.

Placeholder scan:

- No placeholder-marker or deferred-implementation steps are present.
- Every code-changing task includes concrete code snippets and exact commands.

Type consistency:

- `MultiStepStatus` includes `resuming` in both hook and panel.
- `resume` and `canResume` are returned from the hook and consumed by `MultiStepPanel`.
- Durable run types come from `src/lib/executor/runtime/types.ts`.
