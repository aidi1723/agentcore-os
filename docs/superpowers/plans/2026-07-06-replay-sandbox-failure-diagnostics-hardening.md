# Replay Sandbox Failure Diagnostics Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize replay sandbox catalog failure diagnostics by classifying contract build failures, sandbox artifact failures, and no-side-effect guarantee violations.

**Architecture:** Extend the test-fixture replay sandbox report helper with a pure optional `runSandbox` injection seam and per-item failure taxonomy. Extend compact JSON failed items with `failureKind` and `guaranteeErrors`. Tests synthesize failures through fixture clones and injected pure sandbox runners; committed fixtures and default commands remain all green.

**Tech Stack:** TypeScript, Vitest, existing replay sandbox catalog report helper, existing replay result artifact builder, existing subprocess script tests, existing `test:controlled-runtime`.

---

## File Structure

- Modify `src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`
  - Add RED coverage for `contract_build_failed`, `sandbox_artifact_failed`, and `guarantee_violation`.
- Modify `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`
  - Assert compact failed JSON includes `failureKind` and `guaranteeErrors`.
- Modify `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`
  - Add `ReplaySandboxCatalogFailureKind`, `guaranteeErrors`, and optional injected `runSandbox`.
- Modify `src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts`
  - Add `failureKind` and `guaranteeErrors` to failed item output.
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
  - `docs/superpowers/plans/2026-07-06-replay-sandbox-failure-diagnostics-hardening.md`
  - `memory/2026-07-06.md`

---

### Task 1: Add Failing Diagnostics Tests

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`
- Modify: `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`

- [x] **Step 1: Add report-level synthetic failure tests**

Append tests to `src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts`:

```ts
import {
  buildNoSideEffectReplayResultArtifact,
  type ReplayResultArtifact,
} from "@/lib/executor/runtime/replay-sandbox-contracts";
```

Add these tests inside the existing `describe` block:

```ts
  it("classifies contract build failures separately from sandbox failures", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.sourceRunId = "";
    fixture.playbookVersion = "";
    fixture.assertions.redactionBoundary = "optional" as "required";

    const report = buildReplaySandboxCatalogReport([
      {
        id: "sales-pipeline-contract-build-failure",
        playbookId: "sales-pipeline-v1",
        fixture,
      },
    ]);

    expect(report.items[0]).toMatchObject({
      ok: false,
      failureKind: "contract_build_failed",
      artifact: null,
      guaranteeErrors: [],
      errors: [
        "Fixture sourceRunId is required",
        "Fixture playbookVersion is required",
        "Fixture redaction boundary is required",
        "Replay input playbookVersion is required",
        "Replay input redaction boundary is required",
      ],
    });
  });

  it("classifies injected sandbox artifact failures", () => {
    const report = buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
      runSandbox: (contract) =>
        buildNoSideEffectReplayResultArtifact(contract, {
          status: "failed",
          cursorEvents: ["preflight"],
          diagnostics: ["Synthetic sandbox preflight rejection"],
        }),
    });

    expect(report.ok).toBe(false);
    expect(report.items[0]).toMatchObject({
      ok: false,
      failureKind: "sandbox_artifact_failed",
      errors: ["Synthetic sandbox preflight rejection"],
      guaranteeErrors: [],
      artifact: {
        status: "failed",
        diagnostics: ["Synthetic sandbox preflight rejection"],
      },
    });
  });

  it("classifies no-side-effect guarantee violations", () => {
    const report = buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
      runSandbox: (contract): ReplayResultArtifact => ({
        ...buildNoSideEffectReplayResultArtifact(contract, {
          status: "succeeded",
          diagnostics: ["Synthetic replay completed"],
        }),
        guarantees: {
          toolCallsExecuted: true as false,
          assetsWritten: false,
          runtimeStoresMutated: false,
          productionCredentialsUsed: false,
        },
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.items[0]).toMatchObject({
      ok: false,
      failureKind: "guarantee_violation",
      errors: ["Replay sandbox no-side-effect guarantees were not preserved"],
      guaranteeErrors: ["Replay sandbox no-side-effect guarantees were not preserved"],
      artifact: {
        status: "succeeded",
      },
    });
  });
```

- [x] **Step 2: Add compact output failed-item assertions**

In `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`, extend the failed harness item assertion with:

```ts
      failureKind: "contract_build_failed",
      guaranteeErrors: [],
```

and update the local `ReplaySandboxCatalogSummaryOutput` failed item type with:

```ts
    failureKind: "contract_build_failed" | "sandbox_artifact_failed" | "guarantee_violation";
    guaranteeErrors: string[];
```

- [x] **Step 3: Run tests and verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Expected: FAIL because `failureKind`, `guaranteeErrors`, and `runSandbox` injection do not exist.

- [x] **Step 4: Commit failing tests**

```bash
git add src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
git diff --check --cached
git commit -m "test: specify replay sandbox failure diagnostics"
```

---

### Task 2: Implement Failure Taxonomy And Output Fields

**Files:**
- Modify: `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`
- Modify: `src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts`

- [x] **Step 1: Extend report types and injection seam**

In `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`, add:

```ts
export type ReplaySandboxCatalogFailureKind =
  | "contract_build_failed"
  | "sandbox_artifact_failed"
  | "guarantee_violation";

type BuildReplaySandboxCatalogReportOptions = {
  runSandbox?: typeof runNoSideEffectReplaySandbox;
};
```

Extend `ReplaySandboxCatalogReportItem`:

```ts
  failureKind: ReplaySandboxCatalogFailureKind | null;
  guaranteeErrors: string[];
```

Change `buildItem` signature:

```ts
function buildItem(
  entry: ControlledTraceFixtureCatalogEntry,
  options: Required<BuildReplaySandboxCatalogReportOptions>,
): ReplaySandboxCatalogReportItem {
```

Use `options.runSandbox(contractBuild.contract)` instead of calling
`runNoSideEffectReplaySandbox()` directly.

- [x] **Step 2: Add stable classification logic**

For failed contract build items, return:

```ts
failureKind: "contract_build_failed",
guaranteeErrors: [],
```

For successful contract builds:

```ts
const artifact = options.runSandbox(contractBuild.contract);
const artifactErrors = artifact.status === "failed" ? artifact.diagnostics : [];
const guaranteeErrors = guaranteesArePreserved(artifact)
  ? []
  : ["Replay sandbox no-side-effect guarantees were not preserved"];
const errors = [...artifactErrors, ...guaranteeErrors];
const failureKind =
  artifact.status === "failed"
    ? "sandbox_artifact_failed"
    : guaranteeErrors.length > 0
      ? "guarantee_violation"
      : null;
```

Return `failureKind` and `guaranteeErrors` in the item.

Change `buildReplaySandboxCatalogReport` to:

```ts
export function buildReplaySandboxCatalogReport(
  entries: ControlledTraceFixtureCatalogEntry[] = controlledTraceFixtureCatalog,
  options: BuildReplaySandboxCatalogReportOptions = {},
): ReplaySandboxCatalogReport {
  const resolvedOptions = {
    runSandbox: options.runSandbox ?? runNoSideEffectReplaySandbox,
  };
  const items = entries.map((entry) => buildItem(entry, resolvedOptions));
  ...
}
```

- [x] **Step 3: Extend compact failed output**

In `src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts`, add to failed item output:

```ts
        failureKind: item.failureKind,
        guaranteeErrors: item.guaranteeErrors,
```

- [x] **Step 4: Run targeted tests and verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Expected: PASS.

- [x] **Step 5: Run replay sandbox command**

Run:

```bash
npm run replay:sandbox:fixtures --silent
```

Expected: exit 0, `ok: true`, `failedItems: []`.

- [x] **Step 6: Commit implementation**

```bash
git add src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts
git diff --check --cached
git commit -m "feat: classify replay sandbox catalog failures"
```

---

### Task 3: Verify Controlled Runtime Gate

**Files:**
- No source file changes expected.

- [x] **Step 1: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the same 35 files and three more tests than the prior 181 test baseline.

- [x] **Step 2: Commit if package or gate files changed**

No commit is expected for this task unless the command list changes.

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
- Modify: `docs/superpowers/plans/2026-07-06-replay-sandbox-failure-diagnostics-hardening.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Mark this plan complete**

Update this plan's task checkboxes and add completion notes with commits and
verification evidence.

- [x] **Step 2: Update project docs**

Record the new capability as:

```text
Replay sandbox failure diagnostics taxonomy for contract, sandbox, and guarantee failures.
```

Also update the controlled runtime baseline to the observed result from
`npm run test:controlled-runtime`.

Set the next recommended phase to:

```text
Replay Sandbox Failure Harness Expansion
```

- [x] **Step 3: Update daily memory**

Append a concise record to `memory/2026-07-06.md` with:

- phase name;
- files changed;
- commits;
- verification commands and observed results;
- next recommended phase.

- [x] **Step 4: Run final verification**

Run:

```bash
git diff --check
npm run replay:sandbox:fixtures --silent
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

Expected: all commands exit 0.

- [x] **Step 5: Commit docs and records**

```bash
git add CHANGELOG.md README.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md docs/ROADMAP.md docs/superpowers/plans/2026-07-06-replay-sandbox-failure-diagnostics-hardening.md
git diff --check --cached
git commit -m "docs: complete replay sandbox failure diagnostics"
```

---

## Final Verification Checklist

- [x] `git diff --check`
- [x] `npm run replay:sandbox:fixtures --silent`
- [x] `npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`
- [x] `npm run trace:fixtures --silent`
- [x] `npm run trace:fixtures:summary --silent`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`

## Completion Notes

Completed on 2026-07-06.

Commits:

- `0edf721` — `docs: spec replay sandbox failure diagnostics`
- `870f3e3` — `docs: plan replay sandbox failure diagnostics`
- `72b6fef` — `test: specify replay sandbox failure diagnostics`
- `a6e924b` — `feat: classify replay sandbox catalog failures`

TDD evidence:

- RED: targeted replay sandbox catalog report/script tests failed before `failureKind`, `guaranteeErrors`, and injected `runSandbox` existed.
- GREEN: targeted replay sandbox catalog report/script tests passed after implementation.

Delivered capability:

- Replay sandbox failure diagnostics taxonomy for contract, sandbox, and guarantee failures.
- Failed report items now classify `contract_build_failed`, `sandbox_artifact_failed`, and `guarantee_violation`.
- Compact failed JSON now includes `failureKind` and `guaranteeErrors`.
- Default committed fixture catalog remains all green and no-side-effect.

Final verification evidence:

- `git diff --check` — passed.
- `npm run replay:sandbox:fixtures --silent` — passed, 2 total / 2 passed / 0 failed.
- `npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts` — passed, 2 files / 8 tests.
- `npm run trace:fixtures --silent` — passed, 2 total / 2 passed / 0 failed.
- `npm run trace:fixtures:summary --silent` — passed, Status OK.
- `npm run test:controlled-runtime` — passed, 35 files / 184 tests.
- `npm run test:core-workflows` — passed, all core workflow regressions passed.

## Expected Next Phase

Replay Sandbox Failure Harness Expansion: add direct harness modes for contract,
sandbox, and guarantee failures while keeping committed fixture commands green.
