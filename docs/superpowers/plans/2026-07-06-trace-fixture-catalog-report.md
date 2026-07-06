# Trace Fixture Catalog Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure aggregate report for committed governed trace fixture catalog health.

**Architecture:** Keep the helper beside the explicit test fixture catalog so it remains a test/maintenance artifact, not a production runtime dependency. Reuse existing `validateControlledTraceFixture()` and `replayControlledTraceFixture()` results, aggregate them without side effects, and expose Phase 10f diagnostics per item.

**Tech Stack:** TypeScript, Vitest, existing governed trace fixture catalog, existing trace fixture validator, existing pure replay helper.

---

## File Structure

- Create `src/__tests__/fixtures/controlled-traces/catalog-report.ts`: pure aggregate report helper and report types.
- Modify `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`: report assertions for all-green catalog and synthetic drift.
- Modify docs and memory after verification.

---

### Task 1: Catalog Report Tests

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`

- [ ] **Step 1: Add failing imports**

Add this import near the existing catalog import:

```ts
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
```

- [ ] **Step 2: Add all-green aggregate report test**

Add this test inside the existing `describe("controlled trace fixture catalog", () => { ... })` block:

```ts
  it("builds an all-green aggregate report for committed governed fixtures", () => {
    const report = buildControlledTraceFixtureCatalogReport();

    expect(report.ok).toBe(true);
    expect(report.total).toBe(2);
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.fixtureIds).toEqual([
      "sales-pipeline-governed",
      "support-resolution-governed",
    ]);
    expect(report.playbookIds).toEqual(["sales-pipeline-v1", "support-resolution-v1"]);
    expect(report.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
    });
    expect(report.items.map((item) => item.ok)).toEqual([true, true]);
    expect(report.items[0].replay.diagnostics.fixtureStepOrder).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
  });
```

- [ ] **Step 3: Add synthetic drift aggregate report test**

Add this test in the same describe block:

```ts
  it("preserves replay diagnostics for a drifting catalog fixture", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.steps = [fixture.steps[1], fixture.steps[0], ...fixture.steps.slice(2)];

    const report = buildControlledTraceFixtureCatalogReport([
      {
        id: "sales-pipeline-drift",
        playbookId: "sales-pipeline-v1",
        fixture,
      },
    ]);

    expect(report.ok).toBe(false);
    expect(report.total).toBe(1);
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(1);
    expect(report.fixtureIds).toEqual(["sales-pipeline-drift"]);
    expect(report.playbookIds).toEqual(["sales-pipeline-v1"]);
    expect(report.items[0].ok).toBe(false);
    expect(report.items[0].validation).toEqual({ ok: true, errors: [] });
    expect(report.items[0].replay.errors).toContain(
      "Fixture step order does not match current playbook sales-pipeline-v1",
    );
    expect(report.items[0].replay.diagnostics.expectedStepOrder).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(report.items[0].replay.diagnostics.fixtureStepOrder).toEqual([
      "qualify",
      "intake",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(report.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
    });
  });
```

- [ ] **Step 4: Run catalog test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: FAIL because `@/__tests__/fixtures/controlled-traces/catalog-report` does not exist.

---

### Task 2: Catalog Report Helper

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/catalog-report.ts`

- [ ] **Step 1: Create report helper**

Create `src/__tests__/fixtures/controlled-traces/catalog-report.ts` with:

```ts
import {
  controlledTraceFixtureCatalog,
  type ControlledTraceFixtureCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/catalog";
import {
  validateControlledTraceFixture,
  type ControlledTraceFixtureValidationResult,
} from "@/lib/executor/runtime/trace-fixtures";
import {
  replayControlledTraceFixture,
  type ControlledTraceReplayReport,
} from "@/lib/executor/runtime/trace-replay";

export type ControlledTraceFixtureCatalogReportItem = {
  catalogId: string;
  fixtureId: string;
  playbookId: string;
  ok: boolean;
  validation: ControlledTraceFixtureValidationResult;
  replay: ControlledTraceReplayReport;
};

export type ControlledTraceFixtureCatalogReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  items: ControlledTraceFixtureCatalogReportItem[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};

export function buildControlledTraceFixtureCatalogReport(
  entries: ControlledTraceFixtureCatalogEntry[] = controlledTraceFixtureCatalog,
): ControlledTraceFixtureCatalogReport {
  const items = entries.map((entry) => {
    const validation = validateControlledTraceFixture(entry.fixture);
    const replay = replayControlledTraceFixture(entry.fixture);

    return {
      catalogId: entry.id,
      fixtureId: entry.fixture.fixtureId,
      playbookId: entry.playbookId,
      ok: validation.ok && replay.ok,
      validation,
      replay,
    };
  });

  const passed = items.filter((item) => item.ok).length;
  const failed = items.length - passed;

  return {
    ok: failed === 0,
    total: entries.length,
    passed,
    failed,
    fixtureIds: entries.map((entry) => entry.id),
    playbookIds: entries.map((entry) => entry.playbookId),
    items,
    guarantees: {
      toolCallsExecuted: false,
      assetsWritten: false,
    },
  };
}
```

- [ ] **Step 2: Run catalog test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run fixture/replay/catalog focused tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit catalog report implementation**

```bash
git add src/__tests__/fixtures/controlled-traces/catalog-report.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
git commit -m "test: add trace fixture catalog report"
```

---

### Task 3: Verification, Docs, And Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-fixture-catalog-report.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Run full verification before docs**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `lint` and `build` may show only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [ ] **Step 2: Update docs and records**

Record:

- catalog report helper path;
- all-green catalog report behavior;
- synthetic drift diagnostics behavior;
- continued pure metadata boundary;
- next recommended phase.

- [ ] **Step 3: Re-run final verification after docs**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with only the known existing `<img>` warning if present.

- [ ] **Step 4: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-fixture-catalog-report.md
git commit -m "docs: complete trace fixture catalog report"
```

---

## Plan Self-Review

- Spec coverage: aggregate counts, per-fixture validation/replay output, diagnostics preservation, guarantees, tests, docs, and verification are covered.
- Placeholder scan: no placeholder markers remain.
- Type consistency: `ControlledTraceFixtureCatalogReport`, `ControlledTraceFixtureCatalogReportItem`, and `buildControlledTraceFixtureCatalogReport()` match the spec.
