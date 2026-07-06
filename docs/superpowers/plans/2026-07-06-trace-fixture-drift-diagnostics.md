# Trace Fixture Drift Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich governed trace fixture replay reports with structured drift diagnostics while keeping replay pure and existing error messages stable.

**Architecture:** Extend `trace-replay.ts` report types and computation. Reuse the existing playbook lookup and per-step checks, collect diagnostics alongside errors, and keep fixture/catalog tests as pure metadata checks.

**Tech Stack:** TypeScript, Vitest, existing controlled playbook catalog, existing trace fixture replay helper.

---

## File Structure

- Modify `src/lib/executor/runtime/trace-replay.ts`: add diagnostics types and report field.
- Modify `src/__tests__/lib/executor/runtime/trace-replay.test.ts`: add diagnostics assertions for success and drift cases.
- Modify docs and memory after verification.

---

### Task 1: Drift Diagnostics Tests

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/trace-replay.test.ts`

- [x] **Step 1: Add failing diagnostics assertions to success test**

Update the happy-path report expectation to include:

```ts
diagnostics: {
  fixtureId: "controlled-trace-fixture:run-fixture-1",
  playbookId: "sales-pipeline-v1",
  expectedStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
  fixtureStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
  missingApprovalStepIds: [],
  missingWritebackTargets: [],
},
```

- [x] **Step 2: Add failing diagnostics assertions to drift tests**

For step order drift, assert:

```ts
const report = replayControlledTraceFixture(fixture);
expect(report.diagnostics.expectedStepOrder).toEqual([
  "intake",
  "qualify",
  "draft_outreach",
  "human_review",
  "writeback",
]);
expect(report.diagnostics.fixtureStepOrder).toEqual([
  "qualify",
  "intake",
  "draft_outreach",
  "human_review",
  "writeback",
]);
```

For missing approval, assert:

```ts
expect(report.diagnostics.missingApprovalStepIds).toContain("human_review");
```

For missing writeback, assert:

```ts
expect(report.diagnostics.missingWritebackTargets).toContainEqual({
  stepId: "writeback",
  target: "sales_asset",
});
```

For unknown playbook, assert:

```ts
expect(report.diagnostics).toMatchObject({
  fixtureId: "controlled-trace-fixture:run-fixture-1",
  playbookId: "missing-playbook-v1",
  expectedStepOrder: [],
  fixtureStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
  missingApprovalStepIds: [],
  missingWritebackTargets: [],
});
```

- [x] **Step 3: Run test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

Expected: FAIL because `diagnostics` does not exist on the report.

---

### Task 2: Replay Diagnostics Implementation

**Files:**
- Modify: `src/lib/executor/runtime/trace-replay.ts`

- [x] **Step 1: Add diagnostics types and report field**

Add:

```ts
export type ControlledTraceReplayMissingWritebackTarget = {
  stepId: string;
  target: ControlledPlaybookWriteTarget;
};

export type ControlledTraceReplayDiagnostics = {
  fixtureId: string;
  playbookId: string;
  expectedStepOrder: string[];
  fixtureStepOrder: string[];
  missingApprovalStepIds: string[];
  missingWritebackTargets: ControlledTraceReplayMissingWritebackTarget[];
};
```

Add `diagnostics: ControlledTraceReplayDiagnostics` to `ControlledTraceReplayReport`.

- [x] **Step 2: Populate diagnostics in replay**

Implementation rules:

- Set `fixtureStepOrder` from `fixture.steps.map((step) => step.stepId)`.
- For missing playbook, return diagnostics with empty expected order and empty missing lists.
- For registered playbook, collect expected order, missing approvals, and missing writebacks while producing existing errors.
- Return diagnostics in every report.

- [x] **Step 3: Run trace replay test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

Expected: PASS.

- [x] **Step 4: Run trace fixture/catalog tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit diagnostics implementation**

```bash
git add src/lib/executor/runtime/trace-replay.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts
git commit -m "feat: add trace fixture drift diagnostics"
```

---

### Task 3: Docs And Final Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-fixture-drift-diagnostics.md`
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

- replay report includes structured diagnostics;
- existing errors remain stable;
- catalog replay remains pure and green;
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
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-fixture-drift-diagnostics.md
git commit -m "docs: complete trace fixture drift diagnostics"
```

---

## Plan Self-Review

- Spec coverage: diagnostics shape, stable errors, success report, drift cases, catalog safety, docs, and verification are covered.
- Placeholder scan: no placeholder markers remain.
- Type consistency: `ControlledTraceReplayDiagnostics` and `ControlledTraceReplayMissingWritebackTarget` are used consistently.

## Progress Record

- RED verified: `npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts` failed before implementation because `diagnostics` did not exist.
- GREEN verified: `npm test -- src/__tests__/lib/executor/runtime/trace-replay.test.ts` passed after implementation.
- Catalog safety verified: `npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` — 3 files / 11 tests passed.
- Implementation commit: `c14be3a feat: add trace fixture drift diagnostics`.
- Full verification before docs:
  - `npm run test:controlled-runtime` — 26 files / 145 tests passed.
  - `npm run test:core-workflows` — all core workflow regressions passed.
  - `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
  - `npm run build` — exit 0 with the same existing warning.
  - `git diff --check` — exit 0.
- Final verification after docs:
  - `npm run test:controlled-runtime` — 26 files / 145 tests passed.
  - `npm run test:core-workflows` — all core workflow regressions passed.
  - `npm run lint` — exit 0 with the existing `<img>` warning.
  - `npm run build` — exit 0 with the same existing warning.
  - `git diff --check` — exit 0.
