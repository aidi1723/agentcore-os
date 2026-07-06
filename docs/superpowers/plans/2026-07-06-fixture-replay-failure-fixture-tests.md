# Fixture Replay Failure Fixture Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable synthetic failure fixture factories for governed trace replay report and summary tests.

**Architecture:** Keep all failure fixtures inside the test fixture boundary. Add explicit factory functions that clone the committed sales governed fixture, apply drift mutations, and return fresh catalog entries. Refactor existing report/summary tests to consume the factories while committed governed fixture scripts stay green.

**Tech Stack:** TypeScript, Vitest, existing governed trace fixture catalog helpers, existing Node trace fixture scripts.

---

## File Structure

- Create `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`: test-only catalog entry factories for known drift cases.
- Modify `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`: add report coverage for reusable failure entries.
- Modify `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`: replace inline mutation with `buildCombinedSummaryFailureCatalogEntry()`.
- Modify docs after implementation:
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `memory/2026-07-06.md`

## Task 1: Write Failing Report Tests

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- Create later: `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`

- [ ] **Step 1: Import the missing synthetic factories**

Add this import to `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`:

```ts
import {
  buildMissingStableMetadataCatalogEntry,
  buildPlaybookVersionDriftCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/synthetic-failures";
```

- [ ] **Step 2: Add a report test for reusable failure entries**

Add this test before `does not include raw customer content or secret markers`:

```ts
it("builds failed aggregate reports from reusable synthetic failure entries", () => {
  const report = buildControlledTraceFixtureCatalogReport([
    buildPlaybookVersionDriftCatalogEntry(),
    buildMissingStableMetadataCatalogEntry(),
  ]);

  expect(report.ok).toBe(false);
  expect(report.total).toBe(2);
  expect(report.passed).toBe(0);
  expect(report.failed).toBe(2);
  expect(report.fixtureIds).toEqual([
    "sales-pipeline-version-drift",
    "sales-pipeline-missing-stable-metadata",
  ]);
  expect(report.playbookIds).toEqual(["sales-pipeline-v1", "sales-pipeline-v1"]);
  expect(report.guarantees).toEqual({
    toolCallsExecuted: false,
    assetsWritten: false,
  });

  expect(report.items[0].replay.errors).toContain(
    "Fixture playbook version does not match current playbook sales-pipeline-v1",
  );
  expect(report.items[0].replay.diagnostics).toMatchObject({
    expectedPlaybookVersion: "1.0.0",
    fixturePlaybookVersion: "0.9.0",
  });

  expect(report.items[1].replay.errors).toContain(
    "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
  );
  expect(report.items[1].replay.diagnostics.writebackTargetsMissingStableMetadata).toContainEqual({
    stepId: "writeback",
    target: "sales_asset",
    missingFields: ["sourceKey"],
  });
});
```

- [ ] **Step 3: Run RED report test**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: FAIL because `@/__tests__/fixtures/controlled-traces/synthetic-failures` does not exist.

## Task 2: Implement Synthetic Failure Factories

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`

- [ ] **Step 1: Add test-only factories**

Create `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`:

```ts
import {
  controlledTraceFixtureCatalog,
  type ControlledTraceFixtureCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/catalog";

function cloneSalesCatalogEntry(id: string): ControlledTraceFixtureCatalogEntry {
  const salesEntry = controlledTraceFixtureCatalog.find(
    (entry) => entry.id === "sales-pipeline-governed",
  );

  if (!salesEntry) {
    throw new Error("Missing sales-pipeline-governed fixture catalog entry");
  }

  return {
    id,
    playbookId: salesEntry.playbookId,
    fixture: structuredClone(salesEntry.fixture),
  };
}

function removeSalesAssetSourceKey(entry: ControlledTraceFixtureCatalogEntry) {
  const writebackStep = entry.fixture.steps.find((step) => step.stepId === "writeback");
  const salesTarget = writebackStep?.writebackTargets.find(
    (target) => target.target === "sales_asset",
  );

  if (salesTarget) {
    delete salesTarget.sourceKey;
  }

  return entry;
}

export function buildPlaybookVersionDriftCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-version-drift");
  entry.fixture.playbookVersion = "0.9.0";
  return entry;
}

export function buildMissingStableMetadataCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  return removeSalesAssetSourceKey(
    cloneSalesCatalogEntry("sales-pipeline-missing-stable-metadata"),
  );
}

export function buildCombinedSummaryFailureCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = removeSalesAssetSourceKey(
    cloneSalesCatalogEntry("sales-pipeline-summary-drift"),
  );
  entry.fixture.playbookVersion = "0.9.0";
  return entry;
}
```

- [ ] **Step 2: Run GREEN report test**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS with 6 tests.

- [ ] **Step 3: Commit report fixture factories**

Run:

```bash
git add src/__tests__/fixtures/controlled-traces/synthetic-failures.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
git commit -m "test: add synthetic replay failure fixtures"
```

## Task 3: Refactor Summary Failure Test

**Files:**
- Modify: `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`

- [ ] **Step 1: Replace inline fixture mutation imports**

Remove:

```ts
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
```

Add:

```ts
import { buildCombinedSummaryFailureCatalogEntry } from "@/__tests__/fixtures/controlled-traces/synthetic-failures";
```

- [ ] **Step 2: Replace inline mutation with reusable factory**

Replace the setup in `renders failed fixture diagnostics without mutating committed fixtures` with:

```ts
const report = buildControlledTraceFixtureCatalogReport([
  buildCombinedSummaryFailureCatalogEntry(),
]);
```

Keep the existing summary assertions, but update the failed fixture id assertion to:

```ts
expect(summary).toContain("Failed fixture: sales-pipeline-summary-drift");
```

- [ ] **Step 3: Run targeted summary test**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 4: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the controlled runtime suite.

- [ ] **Step 5: Commit summary refactor**

Run:

```bash
git add src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts
git commit -m "test: reuse synthetic summary failure fixture"
```

## Task 4: Docs, Records, And Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update project docs**

Record Phase 10n as completed:

- reusable synthetic failure factories added;
- summary failure test now uses reusable fixtures;
- report tests cover multiple reusable failure entries;
- committed fixture commands remain green.

Set next recommended phase to:

```text
Phase 10o. Fixture Replay Failure Exit-Code Harness
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
git commit -m "docs: complete fixture replay failure fixtures"
```

Do not add `memory/2026-07-06.md` unless project policy changes; it is local continuity.

## Self-Review

- Spec coverage: Tasks cover reusable factories, report tests, summary refactor, docs, and verification.
- Placeholder scan: No placeholder or deferred implementation language is used.
- Type consistency: All factories return `ControlledTraceFixtureCatalogEntry`; report and summary tests consume that same type through `buildControlledTraceFixtureCatalogReport()`.
