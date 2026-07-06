# Trace Fixture Replay Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure replay validation runner that checks committed governed trace fixtures against the current controlled playbook contract without executing tools or writing assets.

**Architecture:** Add `trace-replay.ts` beside the existing trace fixture helper. The runner first applies fixture validation, then compares fixture metadata with the registered playbook definition and returns a deterministic report with non-execution guarantees.

**Tech Stack:** TypeScript, Vitest, existing controlled playbook catalog, existing trace fixture validator.

---

## File Structure

- Create `src/lib/executor/runtime/trace-replay.ts`: replay report type and pure fixture replay validation.
- Create `src/__tests__/lib/executor/runtime/trace-replay.test.ts`: TDD coverage for successful fixture replay and contract mismatch failures.
- Modify `package.json`: include replay tests in `test:controlled-runtime`.
- Modify docs and memory after verification.

---

### Task 1: Replay Runner Tests

**Files:**
- Create: `src/__tests__/lib/executor/runtime/trace-replay.test.ts`

- [x] **Step 1: Write failing happy-path replay test**

Create a test importing the committed fixture:

```ts
import { describe, expect, it } from "vitest";
import sampleFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
import { replayControlledTraceFixture } from "@/lib/executor/runtime/trace-replay";

describe("trace replay", () => {
  it("validates a committed governed sales fixture without executing side effects", () => {
    const report = replayControlledTraceFixture(sampleFixture);

    expect(report).toEqual({
      ok: true,
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      checkedStepIds: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
      errors: [],
      warnings: [],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    });
  });
});
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

Expected: FAIL because `src/lib/executor/runtime/trace-replay.ts` does not exist.

- [x] **Step 3: Add failing contract mismatch tests**

Extend the test file with a clone helper and mismatch cases:

```ts
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

function cloneFixture(): ControlledTraceFixture {
  return structuredClone(sampleFixture) as ControlledTraceFixture;
}
```

Add assertions for:

```ts
const fixture = cloneFixture();
fixture.steps = [fixture.steps[1], fixture.steps[0], ...fixture.steps.slice(2)];
expect(replayControlledTraceFixture(fixture).errors).toContain(
  "Fixture step order does not match current playbook sales-pipeline-v1",
);
```

```ts
const fixture = cloneFixture();
const reviewStep = fixture.steps.find((step) => step.stepId === "human_review");
if (reviewStep) delete reviewStep.approvalState;
expect(replayControlledTraceFixture(fixture).errors).toContain(
  "Step human_review requires approval but fixture has no approval state",
);
```

```ts
const fixture = cloneFixture();
const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
if (writebackStep) writebackStep.writebackTargets = [];
expect(replayControlledTraceFixture(fixture).errors).toContain(
  "Step writeback is missing writeback target sales_asset",
);
```

```ts
const fixture = cloneFixture();
fixture.playbookId = "missing-playbook-v1";
expect(replayControlledTraceFixture(fixture).errors).toContain(
  "Controlled playbook missing-playbook-v1 is not registered",
);
```

Expected: tests still fail because the runner does not exist.

---

### Task 2: Replay Runner Implementation

**Files:**
- Create: `src/lib/executor/runtime/trace-replay.ts`

- [x] **Step 1: Implement minimal pure replay runner**

Create:

```ts
import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import type { ControlledPlaybookWriteTarget } from "@/lib/executor/playbooks/types";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";
import { validateControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

export type ControlledTraceReplayReport = {
  ok: boolean;
  fixtureId: string;
  playbookId: string;
  checkedStepIds: string[];
  errors: string[];
  warnings: string[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};
```

Implementation rules:

- Use `validateControlledTraceFixture(fixture)` and prefix returned errors with `Fixture validation failed: `.
- Compare fixture and playbook step order with a small local `arraysEqual()` helper.
- Use a local `Map` keyed by `stepId` for step lookup.
- Require `approvalState` for steps with `requiresApproval`.
- Require each playbook `writesTo` target on the same fixture step.
- Never import or call stores, routes, tool executors, or writeback helpers.

- [x] **Step 2: Run targeted test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

Expected: PASS.

- [x] **Step 3: Commit runner**

```bash
git add src/lib/executor/runtime/trace-replay.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts
git commit -m "feat: replay governed trace fixtures"
```

---

### Task 3: Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add replay tests to controlled-runtime script**

Insert:

```text
src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

after:

```text
src/__tests__/lib/executor/runtime/trace-fixtures.test.ts
```

- [x] **Step 2: Run controlled runtime tests**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS and includes `trace-replay.test.ts`.

- [x] **Step 3: Commit script coverage**

```bash
git add package.json
git commit -m "test: include trace fixture replay coverage"
```

---

### Task 4: Docs And Final Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-fixture-replay-runner.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Run full verification before docs**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `lint` and `build` may show only the existing `<img>` warning.

- [x] **Step 2: Update docs and records**

Record:

- replay runner exists;
- replay is pure contract validation;
- committed sales fixture passes against current playbook;
- mismatch failures cover step order, required approval, writeback targets, and missing playbook;
- next recommended phase.

- [x] **Step 3: Re-run final verification after docs**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with only the known existing `<img>` warning if present.

- [x] **Step 4: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-fixture-replay-runner.md
git commit -m "docs: complete trace fixture replay runner"
```

---

## Plan Self-Review

- Spec coverage: replay report, base fixture validation, playbook lookup, step order, required approval, writeback target checks, non-execution guarantees, tests, script coverage, docs, and verification are covered.
- Placeholder scan: no placeholder markers remain.
- Type consistency: `ControlledTraceReplayReport` and `replayControlledTraceFixture()` are used consistently across tests and implementation.

## Completion Record

Commits:

- `dc25ff1` — `docs: spec trace fixture replay runner`
- `c84d987` — `feat: replay governed trace fixtures`
- `6d66e7e` — `test: include trace fixture replay coverage`

Verification before final docs:

- `npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts` — 1 file / 5 tests passed.
- `npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts` — 2 files / 8 tests passed.
- `npm run test:controlled-runtime` — 25 files / 142 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.

Final verification after docs:

- `npm run test:controlled-runtime` — 25 files / 142 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.

Next phase:

- Trace Fixture Catalog And Support Coverage.
