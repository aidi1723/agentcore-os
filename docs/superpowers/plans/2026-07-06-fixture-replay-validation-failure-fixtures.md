# Fixture Replay Validation Failure Fixtures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable synthetic validation failure fixtures for governed trace report and summary tests.

**Architecture:** Extend the existing test-only `synthetic-failures.ts` fixture factory module with validation failure factories. Add report tests that consume multiple validation failure entries and summary tests that consume one combined validation failure entry. Keep committed fixture catalog scripts unchanged and green.

**Tech Stack:** TypeScript, Vitest, existing governed trace fixture catalog helpers, existing summary formatter, existing synthetic failure fixture boundary.

---

## File Structure

- Modify `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`: add validation failure factories.
- Modify `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`: add report coverage for multiple reusable validation failure entries.
- Modify `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`: add summary coverage for combined validation failure diagnostics.
- Modify docs after implementation:
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `memory/2026-07-06.md`

## Task 1: Write Failing Report Validation Tests

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- Modify later: `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`

- [ ] **Step 1: Import missing validation failure factories**

Update the synthetic failures import in `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` to:

```ts
import {
  buildMissingSourceRunIdCatalogEntry,
  buildMissingStableMetadataCatalogEntry,
  buildPlaybookVersionDriftCatalogEntry,
  buildUnredactedInputCatalogEntry,
  buildUnredactedToolOutputCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/synthetic-failures";
```

- [ ] **Step 2: Add report test for reusable validation failure entries**

Add this test after `builds failed aggregate reports from reusable synthetic failure entries`:

```ts
it("builds failed aggregate reports from reusable validation failure entries", () => {
  const report = buildControlledTraceFixtureCatalogReport([
    buildMissingSourceRunIdCatalogEntry(),
    buildUnredactedInputCatalogEntry(),
    buildUnredactedToolOutputCatalogEntry(),
  ]);

  expect(report.ok).toBe(false);
  expect(report.total).toBe(3);
  expect(report.passed).toBe(0);
  expect(report.failed).toBe(3);
  expect(report.fixtureIds).toEqual([
    "sales-pipeline-missing-source-run-id",
    "sales-pipeline-unredacted-input",
    "sales-pipeline-unredacted-tool-output",
  ]);
  expect(report.guarantees).toEqual({
    toolCallsExecuted: false,
    assetsWritten: false,
  });

  expect(report.items[0].validation.errors).toContain(
    "Fixture sourceRunId is required",
  );
  expect(report.items[1].validation.errors).toContain(
    "Step intake input is not redacted",
  );
  expect(report.items[2].validation.errors).toContain(
    "Step intake tool llm_generate output is not redacted",
  );
  expect(report.items.map((item) => item.ok)).toEqual([false, false, false]);
});
```

- [ ] **Step 3: Run RED report test**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: FAIL because the new factory exports do not exist.

## Task 2: Implement Validation Failure Factories

**Files:**
- Modify: `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`

- [ ] **Step 1: Add helper functions and exports**

Append these helpers and exports to `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`:

```ts
function findStep(entry: ControlledTraceFixtureCatalogEntry, stepId: string) {
  const step = entry.fixture.steps.find((item) => item.stepId === stepId);
  if (!step) throw new Error(`Missing fixture step ${stepId}`);
  return step;
}

export function buildMissingSourceRunIdCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-missing-source-run-id");
  entry.fixture.sourceRunId = "";
  return entry;
}

export function buildUnredactedInputCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-unredacted-input");
  findStep(entry, "intake").hasRedactedInput = false;
  return entry;
}

export function buildUnredactedToolOutputCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-unredacted-tool-output");
  const intakeStep = findStep(entry, "intake");
  const toolCall = intakeStep.toolCalls[0];
  if (!toolCall) throw new Error("Missing intake fixture tool call");
  toolCall.outputRedacted = false;
  return entry;
}

export function buildCombinedValidationFailureCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-validation-failure");
  entry.fixture.sourceRunId = "";
  const intakeStep = findStep(entry, "intake");
  intakeStep.hasRedactedInput = false;
  const toolCall = intakeStep.toolCalls[0];
  if (!toolCall) throw new Error("Missing intake fixture tool call");
  toolCall.outputRedacted = false;
  return entry;
}
```

- [ ] **Step 2: Run GREEN report test**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS with 7 tests.

- [ ] **Step 3: Commit report validation fixtures**

Run:

```bash
git add src/__tests__/fixtures/controlled-traces/synthetic-failures.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
git commit -m "test: add synthetic validation failure fixtures"
```

## Task 3: Add Summary Coverage For Validation Failures

**Files:**
- Modify: `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`

- [ ] **Step 1: Import combined validation failure factory**

Update the synthetic failures import in `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts` to:

```ts
import {
  buildCombinedSummaryFailureCatalogEntry,
  buildCombinedValidationFailureCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/synthetic-failures";
```

- [ ] **Step 2: Add summary validation failure test**

Add this test after `renders failed fixture diagnostics without mutating committed fixtures`:

```ts
it("renders validation failure diagnostics from reusable fixtures", () => {
  const report = buildControlledTraceFixtureCatalogReport([
    buildCombinedValidationFailureCatalogEntry(),
  ]);

  const summary = formatControlledTraceFixtureCatalogSummary(report);

  expect(summary).toContain("Status: FAILED");
  expect(summary).toContain("Fixtures: 1 total, 0 passed, 1 failed");
  expect(summary).toContain("Failed fixture: sales-pipeline-validation-failure");
  expect(summary).toContain(
    "validationErrors: Fixture sourceRunId is required, Step intake input is not redacted, Step intake tool llm_generate output is not redacted",
  );
});
```

- [ ] **Step 3: Run targeted summary test**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 4: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the controlled runtime suite.

- [ ] **Step 5: Commit summary validation coverage**

Run:

```bash
git add src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts
git commit -m "test: render validation failure summaries"
```

## Task 4: Docs, Records, And Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update project docs and local memory**

Record Phase 10p as completed:

- reusable validation failure factories added;
- report tests cover missing source run id, unredacted input, and unredacted tool output;
- summary tests render combined validation errors;
- committed fixture commands remain green.

Set next recommended phase to:

```text
Phase 10q. Fixture Replay Failure Documentation Matrix
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
git status --short
```

Expected:

- fixture JSON command exits 0 with `ok: true`, `total: 2`, `failed: 0`;
- summary command exits 0 with `Status: OK`;
- controlled runtime and core workflow tests pass;
- lint/build exit 0, with only the existing `<img>` warning if it appears;
- `git diff --check` exits 0;
- status shows only intended doc changes plus known unrelated untracked files.

- [ ] **Step 3: Commit docs**

Run:

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md
git commit -m "docs: complete fixture replay validation failures"
```

Do not add `memory/2026-07-06.md`; it is local continuity.

## Self-Review

- Spec coverage: Tasks cover validation failure factories, report coverage, summary coverage, docs, and verification.
- Placeholder scan: No deferred implementation language is used.
- Type consistency: All factories return `ControlledTraceFixtureCatalogEntry`; report and summary tests consume entries through `buildControlledTraceFixtureCatalogReport()`.
