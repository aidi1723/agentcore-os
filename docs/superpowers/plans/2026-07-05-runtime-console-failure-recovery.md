# Runtime Console Failure Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, auditable retry controls for eligible failed controlled runs from Runtime Console.

**Architecture:** Extend durable controlled run state with audit events, derive retry eligibility in the console summary helper, add a retry runtime function and route that reuse the existing multi-step execution path from the failed step, then wire a compact Runtime Console action. Retry is policy-gated by the playbook step's `onFailure.action === "retry"`.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, existing controlled runtime store and executor.

---

## Scope

Spec: [Runtime Console Failure Recovery Design](../specs/2026-07-05-runtime-console-failure-recovery-design.md)

In scope:

- Controlled run audit event type and store normalization.
- Summary fields for `failedStepId`, `canRetry`, `retryReason`, and audit event count.
- `retryControlledExecutionRun(runId)` runtime function.
- `POST /api/runtime/executor/controlled-runs/[runId]/retry`.
- Runtime Console retry button for eligible failed runs.
- Documentation and verification update.

Out of scope:

- Arbitrary step selection.
- Rollback.
- Automatic polling.
- Retrying approval rejection failures.
- Retrying non-retryable failed steps.

## File Structure

Modify:

- `src/lib/executor/runtime/types.ts`
- `src/lib/server/controlled-execution-store.ts`
- `src/lib/executor/runtime/console-summary.ts`
- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- `src/lib/executor/runtime/resume.ts`
- `src/__tests__/lib/executor/runtime/resume.test.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `CHANGELOG.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/NEXT_STEPS.md`
- `memory/2026-07-05.md`

Create:

- `src/app/api/runtime/executor/controlled-runs/[runId]/retry/route.ts`
- `src/__tests__/app/api/controlled-run-retry-route.test.ts`

---

### Task 1: Add Audit Event State

- [ ] **Step 1: Write failing store normalization test**

Extend `src/__tests__/lib/server/controlled-execution-store.test.ts` with a test that creates or updates a run with an audit event and verifies it is persisted through `getControlledExecutionRun`.

- [ ] **Step 2: Verify test fails**

Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Expected: FAIL because controlled run records do not expose `auditEvents`.

- [ ] **Step 3: Implement audit event type and store support**

Modify `src/lib/executor/runtime/types.ts`:

```ts
export type ControlledRunAuditEvent = {
  id: string;
  type: "console_retry_requested";
  stepId?: string;
  message?: string;
  createdAt: number;
  actor: "local_user";
};
```

Add `auditEvents: ControlledRunAuditEvent[]` to `ControlledExecutionRunRecord`.

Normalize missing audit events to `[]` in `controlled-execution-store.ts`, and add an append helper:

```ts
appendControlledRunAuditEvent(runId, event)
```

- [ ] **Step 4: Verify store tests pass**

Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/types.ts src/lib/server/controlled-execution-store.ts src/__tests__/lib/server/controlled-execution-store.test.ts
git commit -m "feat: audit controlled run recovery events"
```

### Task 2: Derive Retry Eligibility In Console Summary

- [ ] **Step 1: Write failing summary tests**

Extend `src/__tests__/lib/executor/runtime/console-summary.test.ts` with:

- a failed run whose failed step has `onFailure: { action: "retry", maxRetries: 1 }`, expecting `failedStepId`, `canRetry: true`, and `auditEventCount`,
- a failed run whose failed step has no retry policy, expecting `canRetry: false` and `retryReason`.

- [ ] **Step 2: Verify summary tests fail**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: FAIL because retry summary fields do not exist.

- [ ] **Step 3: Implement summary fields**

Modify `src/lib/executor/runtime/console-summary.ts`:

- add `failedStepId?: string`,
- add `canRetry: boolean`,
- add `retryReason?: string`,
- add `auditEventCount: number`,
- derive retry only for failed runs with first failed step and matching plan step `onFailure.action === "retry"`.

- [ ] **Step 4: Verify summary tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/console-summary.ts src/__tests__/lib/executor/runtime/console-summary.test.ts
git commit -m "feat: summarize controlled run retry eligibility"
```

### Task 3: Implement Retry Runtime And Route

- [ ] **Step 1: Write failing retry runtime tests**

Extend `src/__tests__/lib/executor/runtime/resume.test.ts` with tests that:

- seed a failed run with one completed prior step and one failed retryable step,
- call `retryControlledExecutionRun(runId)`,
- verify only the failed step is retried,
- verify an audit event is recorded,
- verify non-retryable failed steps return `409`.

- [ ] **Step 2: Write failing retry route tests**

Create `src/__tests__/app/api/controlled-run-retry-route.test.ts` covering:

- `404` for missing run,
- `409` for non-retryable failed run,
- `200` for retryable failed run.

- [ ] **Step 3: Verify retry tests fail**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/resume.test.ts src/__tests__/app/api/controlled-run-retry-route.test.ts
```

Expected: FAIL because retry runtime and route do not exist.

- [ ] **Step 4: Implement retry runtime**

Modify `src/lib/executor/runtime/resume.ts`:

- export `retryControlledExecutionRun(runId)`,
- find the first failed step in playbook order,
- reject missing, non-failed, terminal non-failed, awaiting approval, and non-retryable states,
- append `console_retry_requested`,
- reset run and failed step into retryable execution state,
- call `executeMultiStep` with `startStepIndex`,
- return updated run and `retriedStepIds`.

- [ ] **Step 5: Implement retry route**

Create `src/app/api/runtime/executor/controlled-runs/[runId]/retry/route.ts` using the same auth and response conventions as the resume route.

- [ ] **Step 6: Verify retry tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/resume.test.ts src/__tests__/app/api/controlled-run-retry-route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/executor/runtime/resume.ts src/app/api/runtime/executor/controlled-runs/[runId]/retry/route.ts src/__tests__/lib/executor/runtime/resume.test.ts src/__tests__/app/api/controlled-run-retry-route.test.ts
git commit -m "feat: retry failed controlled run steps"
```

### Task 4: Wire Runtime Console Retry Action

- [ ] **Step 1: Add retry handler**

Modify `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`:

- add `handleRetryControlledRun(runId)`,
- POST to `/api/runtime/executor/controlled-runs/[runId]/retry`,
- reuse `controlledRunActionLoading`,
- refresh controlled runs after success.

- [ ] **Step 2: Render failed run recovery UI**

In selected run detail:

- show failed step id and retry reason,
- render `重试失败步骤` when `canRetry`,
- keep existing approve / reject / resume behavior unchanged.

- [ ] **Step 3: Verify controlled runtime, lint, and build**

Run:

```bash
npm run test:controlled-runtime
npm run lint
npm run build
```

Expected: PASS, with only the existing `<img>` warning for lint/build.

- [ ] **Step 4: Commit**

```bash
git add src/components/apps/ClawRuntimeConsoleAppWindow.tsx
git commit -m "feat: retry controlled runs from runtime console"
```

### Task 5: Final Verification And Docs

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

- [ ] **Step 2: Update docs and memory**

Update changelog, development manual, next steps, this plan checklist, and daily memory.

- [ ] **Step 3: Commit docs**

```bash
git add CHANGELOG.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/NEXT_STEPS.md docs/superpowers/plans/2026-07-05-runtime-console-failure-recovery.md
git commit -m "docs: track runtime console failure recovery"
```

## Self-Review

- Spec coverage: audit state, retry eligibility, retry runtime, retry route, Runtime Console action, docs, and verification are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: `auditEvents`, `failedStepId`, `canRetry`, `retryReason`, and `retriedStepIds` use stable names across spec and plan.
