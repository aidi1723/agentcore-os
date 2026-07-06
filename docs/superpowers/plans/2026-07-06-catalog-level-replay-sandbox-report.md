# Catalog-Level Replay Sandbox Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure aggregate report that runs committed governed fixture catalog entries through the fixture-to-contract bridge and no-side-effect replay sandbox prototype.

**Architecture:** Add a test-fixture-side report helper beside the existing governed fixture catalog helpers. The helper accepts explicit catalog entries, builds replay sandbox contracts, runs the no-side-effect sandbox only for successful contracts, and returns aggregate pass/fail counts, per-entry diagnostics, sandbox artifacts, and no-side-effect guarantees without touching routes, stores, files, tools, UI, or business assets.

**Tech Stack:** TypeScript, Vitest, existing governed trace fixture catalog, existing fixture contract bridge, existing replay sandbox prototype, existing `test:controlled-runtime`.

---

## File Structure

- Create `src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`
  - Failing tests for aggregate report success, per-item artifacts, failed contract builds, and no-side-effect guarantees.
- Create `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`
  - Pure test-fixture helper that composes catalog entries, `buildReplaySandboxContractFromFixture()`, and `runNoSideEffectReplaySandbox()`.
- Modify `package.json`
  - Add the new test file to `test:controlled-runtime` after `replay-sandbox-fixture-contract.test.ts`.
- Modify docs after implementation:
  - `CHANGELOG.md`
  - `README.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - `docs/NEXT_STEPS.md`
  - `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`
  - `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
  - `docs/ROADMAP.md`
  - `docs/superpowers/plans/2026-07-06-catalog-level-replay-sandbox-report.md`
  - `memory/2026-07-06.md`

---

### Task 1: Add Failing Catalog Report Tests

**Files:**
- Create: `src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";

describe("replay sandbox catalog report", () => {
  it("builds an all-green replay sandbox report for committed governed fixtures", () => {
    const report = buildReplaySandboxCatalogReport();

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
      runtimeStoresMutated: false,
      productionCredentialsUsed: false,
    });
    expect(report.items.map((item) => item.ok)).toEqual([true, true]);
    expect(report.items.map((item) => item.artifact?.status)).toEqual([
      "succeeded",
      "succeeded",
    ]);
  });

  it("preserves per-item sandbox artifacts and simulated approval metadata", () => {
    const report = buildReplaySandboxCatalogReport();

    expect(report.items[0]).toMatchObject({
      catalogId: "sales-pipeline-governed",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      ok: true,
      errors: [],
      artifact: {
        schemaVersion: "replay-result-artifact/v1",
        replayId: "replay:controlled-trace-fixture:run-fixture-1",
        sandboxId: "sandbox:controlled-trace-fixture:run-fixture-1",
        status: "succeeded",
        source: {
          kind: "committed_fixture",
          playbookId: "sales-pipeline-v1",
          redactionBoundary: "required",
        },
        simulatedApprovals: [
          {
            stepId: "human_review",
            decision: "approved",
          },
          {
            stepId: "writeback",
            decision: "approved",
          },
        ],
        cursorEvents: [
          "preflight",
          "load_source_metadata",
          "simulate_approvals",
          "block_side_effects",
          "emit_result_artifact",
        ],
        guarantees: {
          toolCallsExecuted: false,
          assetsWritten: false,
          runtimeStoresMutated: false,
          productionCredentialsUsed: false,
        },
      },
    });
    expect(report.items[0].contractBuild.ok).toBe(true);
  });

  it("returns a failed report when a fixture cannot build a sandbox contract", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.sourceRunId = "";
    fixture.playbookVersion = "";
    fixture.assertions.redactionBoundary = "optional" as "required";

    const report = buildReplaySandboxCatalogReport([
      {
        id: "sales-pipeline-broken-contract",
        playbookId: "sales-pipeline-v1",
        fixture,
      },
    ]);

    expect(report.ok).toBe(false);
    expect(report.total).toBe(1);
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(1);
    expect(report.fixtureIds).toEqual(["sales-pipeline-broken-contract"]);
    expect(report.playbookIds).toEqual(["sales-pipeline-v1"]);
    expect(report.items[0].ok).toBe(false);
    expect(report.items[0].artifact).toBeNull();
    expect(report.items[0].errors).toEqual([
      "Fixture sourceRunId is required",
      "Fixture playbookVersion is required",
      "Fixture redaction boundary is required",
      "Replay input playbookVersion is required",
      "Replay input redaction boundary is required",
    ]);
    expect(report.items[0].contractBuild.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
```

Expected: FAIL because `@/__tests__/fixtures/controlled-traces/replay-sandbox-report` does not exist.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
git diff --check --cached
git commit -m "test: specify replay sandbox catalog report"
```

---

### Task 2: Implement The Pure Catalog Report Helper

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`

- [ ] **Step 1: Add the report helper**

Create `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`:

```ts
import {
  controlledTraceFixtureCatalog,
  type ControlledTraceFixtureCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/catalog";
import {
  buildReplaySandboxContractFromFixture,
  type ReplaySandboxContractBuildResult,
} from "@/lib/executor/runtime/replay-sandbox-fixture-contract";
import { runNoSideEffectReplaySandbox } from "@/lib/executor/runtime/replay-sandbox";
import type {
  ReplayResultArtifact,
  ReplaySandboxGuarantees,
} from "@/lib/executor/runtime/replay-sandbox-contracts";

export type ReplaySandboxCatalogReportItem = {
  catalogId: string;
  fixtureId: string;
  playbookId: string;
  ok: boolean;
  contractBuild: ReplaySandboxContractBuildResult;
  artifact: ReplayResultArtifact | null;
  errors: string[];
};

export type ReplaySandboxCatalogReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  items: ReplaySandboxCatalogReportItem[];
  guarantees: ReplaySandboxGuarantees;
};

const replaySandboxCatalogGuarantees: ReplaySandboxGuarantees = {
  toolCallsExecuted: false,
  assetsWritten: false,
  runtimeStoresMutated: false,
  productionCredentialsUsed: false,
};

function guaranteesArePreserved(artifact: ReplayResultArtifact) {
  return (
    artifact.guarantees.toolCallsExecuted === false &&
    artifact.guarantees.assetsWritten === false &&
    artifact.guarantees.runtimeStoresMutated === false &&
    artifact.guarantees.productionCredentialsUsed === false
  );
}

function buildItem(entry: ControlledTraceFixtureCatalogEntry): ReplaySandboxCatalogReportItem {
  const contractBuild = buildReplaySandboxContractFromFixture(entry.fixture);

  if (!contractBuild.ok) {
    return {
      catalogId: entry.id,
      fixtureId: entry.fixture.fixtureId,
      playbookId: entry.playbookId,
      ok: false,
      contractBuild,
      artifact: null,
      errors: contractBuild.errors,
    };
  }

  const artifact = runNoSideEffectReplaySandbox(contractBuild.contract);
  const artifactErrors = artifact.status === "failed" ? artifact.diagnostics : [];
  const guaranteeErrors = guaranteesArePreserved(artifact)
    ? []
    : ["Replay sandbox no-side-effect guarantees were not preserved"];
  const errors = [...artifactErrors, ...guaranteeErrors];

  return {
    catalogId: entry.id,
    fixtureId: entry.fixture.fixtureId,
    playbookId: entry.playbookId,
    ok: artifact.status === "succeeded" && errors.length === 0,
    contractBuild,
    artifact,
    errors,
  };
}

export function buildReplaySandboxCatalogReport(
  entries: ControlledTraceFixtureCatalogEntry[] = controlledTraceFixtureCatalog,
): ReplaySandboxCatalogReport {
  const items = entries.map(buildItem);
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
    guarantees: replaySandboxCatalogGuarantees,
  };
}
```

- [ ] **Step 2: Run targeted tests and verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run adjacent replay sandbox tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts src/__tests__/lib/executor/runtime/replay-sandbox.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit implementation**

```bash
git add src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts
git diff --check --cached
git commit -m "feat: add replay sandbox catalog report"
```

---

### Task 3: Add The Report Test To Controlled Runtime Gate

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the test path to `test:controlled-runtime`**

In `package.json`, insert:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
```

after:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts
```

- [ ] **Step 2: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with one more test file and three more tests than the previous 33 files / 176 tests baseline.

- [ ] **Step 3: Commit gate update**

```bash
git add package.json
git diff --check --cached
git commit -m "test: include replay sandbox catalog report in controlled runtime"
```

---

### Task 4: Align Documentation And Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/superpowers/plans/2026-07-06-catalog-level-replay-sandbox-report.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Mark this plan complete**

Update this plan's task checkboxes and add a short completion note with commits
and verification evidence.

- [ ] **Step 2: Update project docs**

Record the new capability as:

```text
Catalog-level replay sandbox report for committed governed fixtures.
```

Also update the controlled runtime baseline from 33 files / 176 tests to the
new count observed from `npm run test:controlled-runtime`.

Set the next recommended phase to:

```text
Replay Sandbox Catalog CI Summary
```

- [ ] **Step 3: Update daily memory**

Append a concise record to `memory/2026-07-06.md` with:

- phase name;
- files added;
- commits;
- verification commands and observed results;
- next recommended phase.

- [ ] **Step 4: Run final verification**

Run:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit docs and records**

```bash
git add CHANGELOG.md README.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md docs/ROADMAP.md docs/superpowers/plans/2026-07-06-catalog-level-replay-sandbox-report.md memory/2026-07-06.md
git diff --check --cached
git commit -m "docs: complete replay sandbox catalog report"
```

---

## Final Verification Checklist

- [ ] `git diff --check`
- [ ] `npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`
- [ ] `npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts src/__tests__/lib/executor/runtime/replay-sandbox.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`
- [ ] `npm run trace:fixtures --silent`
- [ ] `npm run trace:fixtures:summary --silent`
- [ ] `npm run test:controlled-runtime`
- [ ] `npm run test:core-workflows`

## Expected Next Phase

Replay Sandbox Catalog CI Summary: add a local compact JSON command over
`buildReplaySandboxCatalogReport()` that exits non-zero when the sandbox report
fails, while keeping the same no-side-effect boundary.
