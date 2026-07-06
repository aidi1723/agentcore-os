# Trace Fixture Catalog And Support Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit governed trace fixture catalog and support fixture so `test:controlled-runtime` replay-validates all committed fixtures.

**Architecture:** Keep fixtures as committed JSON under `src/__tests__/fixtures/controlled-traces/`. Add a tiny explicit TypeScript catalog that imports each fixture and a pure catalog replay test that validates and replays each entry through existing fixture and replay helpers.

**Tech Stack:** TypeScript, Vitest, existing `ControlledTraceFixture`, `validateControlledTraceFixture()`, and `replayControlledTraceFixture()`.

---

## File Structure

- Create `src/__tests__/fixtures/controlled-traces/catalog.ts`: explicit list of committed governed trace fixtures.
- Create `src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json`: safe support playbook fixture.
- Create `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`: catalog validation and replay coverage.
- Modify `package.json`: include catalog replay tests in `test:controlled-runtime`.
- Modify docs and memory after verification.

---

### Task 1: Catalog Replay Test

**Files:**
- Create: `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`

- [ ] **Step 1: Write failing catalog test**

Create:

```ts
import { describe, expect, it } from "vitest";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { validateControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";
import { replayControlledTraceFixture } from "@/lib/executor/runtime/trace-replay";

describe("controlled trace fixture catalog", () => {
  it("lists sales and support governed fixtures", () => {
    expect(controlledTraceFixtureCatalog.map((entry) => entry.id)).toEqual([
      "sales-pipeline-governed",
      "support-resolution-governed",
    ]);
  });

  it("validates and replays every committed governed fixture", () => {
    for (const entry of controlledTraceFixtureCatalog) {
      expect(entry.fixture.playbookId).toBe(entry.playbookId);
      expect(validateControlledTraceFixture(entry.fixture)).toEqual({ ok: true, errors: [] });

      const replay = replayControlledTraceFixture(entry.fixture);
      expect(replay.errors).toEqual([]);
      expect(replay.ok).toBe(true);
      expect(replay.guarantees).toEqual({
        toolCallsExecuted: false,
        assetsWritten: false,
      });
    }
  });

  it("does not include raw customer content or secret markers", () => {
    const serialized = JSON.stringify(controlledTraceFixtureCatalog);

    expect(serialized).not.toContain("Nora");
    expect(serialized).not.toContain("sk-fixture-secret");
    expect(serialized).not.toContain("refund my order");
    expect(serialized).not.toContain("Bearer ");
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: FAIL because `src/__tests__/fixtures/controlled-traces/catalog.ts` does not exist.

---

### Task 2: Fixture Catalog And Support Fixture

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/catalog.ts`
- Create: `src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json`

- [ ] **Step 1: Add explicit fixture catalog**

Create:

```ts
import salesPipelineFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
import supportResolutionFixture from "@/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

export type ControlledTraceFixtureCatalogEntry = {
  id: string;
  playbookId: string;
  fixture: ControlledTraceFixture;
};

export const controlledTraceFixtureCatalog: ControlledTraceFixtureCatalogEntry[] = [
  {
    id: "sales-pipeline-governed",
    playbookId: "sales-pipeline-v1",
    fixture: salesPipelineFixture as ControlledTraceFixture,
  },
  {
    id: "support-resolution-governed",
    playbookId: "support-resolution-v1",
    fixture: supportResolutionFixture as ControlledTraceFixture,
  },
];
```

- [ ] **Step 2: Add support fixture JSON**

Create `support-resolution-governed.fixture.json` with:

- `schemaVersion: "controlled-trace-fixture/v1"`
- `playbookId: "support-resolution-v1"`
- `playbookVersion: "1.0.0"`
- `scenarioId: "support-ops"`
- `workflowRunId: "support-workflow-fixture-1"`
- step order: `intake`, `classify`, `draft_reply`, `human_review`, `writeback`
- every step has `hasRedactedInput: true`, `hasRedactedOutput: true`, and redacted tool output.
- approval state on `human_review` and `writeback`.
- writeback targets matching the current support playbook contract.

- [ ] **Step 3: Run catalog test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit catalog and fixture**

```bash
git add src/__tests__/fixtures/controlled-traces/catalog.ts src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
git commit -m "test: catalog governed trace fixtures"
```

---

### Task 3: Controlled Runtime Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add catalog test to controlled-runtime script**

Insert:

```text
src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

after:

```text
src/__tests__/lib/executor/runtime/trace-replay.test.ts
```

- [ ] **Step 2: Run controlled runtime tests**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS and includes `trace-fixture-catalog.test.ts`.

- [ ] **Step 3: Commit script coverage**

```bash
git add package.json
git commit -m "test: include trace fixture catalog coverage"
```

---

### Task 4: Docs And Final Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-fixture-catalog-support-coverage.md`
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

Expected: all commands exit 0. `lint` and `build` may show only the existing `<img>` warning.

- [ ] **Step 2: Update docs and records**

Record:

- fixture catalog exists;
- support governed fixture exists;
- sales and support fixtures replay through the catalog;
- no runtime replay or asset mutation was added;
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
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-fixture-catalog-support-coverage.md
git commit -m "docs: complete trace fixture catalog support coverage"
```

---

## Plan Self-Review

- Spec coverage: explicit catalog, support fixture, catalog replay test, controlled-runtime coverage, docs, and verification are covered.
- Placeholder scan: no placeholder markers remain.
- Type consistency: `ControlledTraceFixtureCatalogEntry`, `controlledTraceFixtureCatalog`, and existing replay/validation helpers are used consistently.
