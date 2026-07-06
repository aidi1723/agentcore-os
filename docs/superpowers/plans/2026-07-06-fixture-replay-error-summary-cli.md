# Fixture Replay Error Summary CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a human-readable governed fixture replay summary command while preserving the existing machine-readable JSON command.

**Architecture:** Reuse `buildControlledTraceFixtureCatalogReport()` as the single report source. Add a small formatter under `src/__tests__/fixtures/controlled-traces/catalog-summary.ts`, then add `scripts/trace-fixtures/catalog-summary.mjs` as a thin CLI wrapper. Tests cover both all-green subprocess behavior and synthetic failure formatting without mutating committed fixtures.

**Tech Stack:** TypeScript, Vitest, Node subprocess tests, existing `register-ts-alias-loader.mjs`, existing governed trace fixture catalog helpers.

---

## File Structure

- Create `src/__tests__/fixtures/controlled-traces/catalog-summary.ts`: pure formatter for human-readable catalog summaries.
- Create `scripts/trace-fixtures/catalog-summary.mjs`: CLI wrapper for the formatter.
- Create `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`: subprocess and formatter tests.
- Modify `package.json`: add `trace:fixtures:summary` and include the new test in `test:controlled-runtime`.
- Modify docs after implementation:
  - `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
  - `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
  - `docs/NEXT_STEPS.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `CHANGELOG.md`
  - `memory/2026-07-06.md`

## Task 1: Write Failing Summary Tests

**Files:**
- Create: `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`

- [ ] **Step 1: Add subprocess test for all-green summary**

Create the test file with:

```ts
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("trace fixture catalog summary script", () => {
  it("prints a human-readable all-green summary for committed governed fixtures", () => {
    const result = spawnSync("npm", ["run", "trace:fixtures:summary", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");
    expect(result.stdout).toContain("Governed trace fixture replay summary");
    expect(result.stdout).toContain("Status: OK");
    expect(result.stdout).toContain("Fixtures: 2 total, 2 passed, 0 failed");
    expect(result.stdout).toContain("Catalog: sales-pipeline-governed, support-resolution-governed");
    expect(result.stdout).toContain("Playbooks: sales-pipeline-v1, support-resolution-v1");
    expect(result.stdout).toContain("Guarantees: toolCallsExecuted=false, assetsWritten=false");
  });
});
```

- [ ] **Step 2: Add JSON command stability test**

In the same file, add:

```ts
it("keeps the existing JSON fixture command parseable", () => {
  const result = spawnSync("npm", ["run", "trace:fixtures", "--silent"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  expect(result.status).toBe(0);
  expect(result.stderr.trim()).toBe("");
  const output = JSON.parse(result.stdout) as { ok: boolean; total: number; failed: number };
  expect(output).toMatchObject({ ok: true, total: 2, failed: 0 });
});
```

- [ ] **Step 3: Add synthetic failure formatter test**

Add imports:

```ts
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { formatControlledTraceFixtureCatalogSummary } from "@/__tests__/fixtures/controlled-traces/catalog-summary";
```

Then add:

```ts
it("renders failed fixture diagnostics without mutating committed fixtures", () => {
  const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
  fixture.playbookVersion = "0.9.0";
  const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
  const salesTarget = writebackStep?.writebackTargets.find(
    (target) => target.target === "sales_asset",
  );
  if (salesTarget) delete salesTarget.sourceKey;

  const report = buildControlledTraceFixtureCatalogReport([
    {
      id: "sales-pipeline-drift",
      playbookId: "sales-pipeline-v1",
      fixture,
    },
  ]);

  const summary = formatControlledTraceFixtureCatalogSummary(report);

  expect(summary).toContain("Status: FAILED");
  expect(summary).toContain("Fixtures: 1 total, 0 passed, 1 failed");
  expect(summary).toContain("Failed fixture: sales-pipeline-drift");
  expect(summary).toContain("Fixture playbook version does not match current playbook sales-pipeline-v1");
  expect(summary).toContain("Step writeback writeback target sales_asset is missing stable metadata sourceKey");
  expect(summary).toContain("expectedPlaybookVersion: 1.0.0");
  expect(summary).toContain("fixturePlaybookVersion: 0.9.0");
  expect(summary).toContain("writebackTargetsMissingStableMetadata: writeback:sales_asset missing sourceKey");
});
```

- [ ] **Step 4: Run RED test**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts
```

Expected: FAIL because the package script and formatter file do not exist yet.

## Task 2: Implement Formatter And CLI

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/catalog-summary.ts`
- Create: `scripts/trace-fixtures/catalog-summary.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add formatter helper**

Create `src/__tests__/fixtures/controlled-traces/catalog-summary.ts`:

```ts
import type {
  ControlledTraceFixtureCatalogReport,
  ControlledTraceFixtureCatalogReportItem,
} from "@/__tests__/fixtures/controlled-traces/catalog-report";

function joinOrNone(values: string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatArray(name: string, values: string[]) {
  return `${name}: ${joinOrNone(values)}`;
}

function formatMissingWritebackTargets(
  item: ControlledTraceFixtureCatalogReportItem,
) {
  return item.replay.diagnostics.missingWritebackTargets.map(
    (target) => `${target.stepId}:${target.target}`,
  );
}

function formatMissingStableMetadata(item: ControlledTraceFixtureCatalogReportItem) {
  return item.replay.diagnostics.writebackTargetsMissingStableMetadata.map(
    (target) => `${target.stepId}:${target.target} missing ${target.missingFields.join(",")}`,
  );
}

function formatFailedItem(item: ControlledTraceFixtureCatalogReportItem) {
  const diagnostics = item.replay.diagnostics;
  const lines = [
    `Failed fixture: ${item.catalogId}`,
    `  fixtureId: ${item.fixtureId}`,
    `  playbookId: ${item.playbookId}`,
    `  validationErrors: ${joinOrNone(item.validation.errors)}`,
    `  replayErrors: ${joinOrNone(item.replay.errors)}`,
    `  expectedStepOrder: ${joinOrNone(diagnostics.expectedStepOrder)}`,
    `  fixtureStepOrder: ${joinOrNone(diagnostics.fixtureStepOrder)}`,
    `  expectedPlaybookVersion: ${diagnostics.expectedPlaybookVersion ?? "none"}`,
    `  fixturePlaybookVersion: ${diagnostics.fixturePlaybookVersion}`,
    `  expectedScenarioId: ${diagnostics.expectedScenarioId ?? "none"}`,
    `  fixtureScenarioId: ${diagnostics.fixtureScenarioId ?? "none"}`,
    `  expectedPlanId: ${diagnostics.expectedPlanId ?? "none"}`,
    `  fixturePlanId: ${diagnostics.fixturePlanId ?? "none"}`,
    `  expectedPlanTotalSteps: ${diagnostics.expectedPlanTotalSteps ?? "none"}`,
    `  fixturePlanTotalSteps: ${diagnostics.fixturePlanTotalSteps ?? "none"}`,
    `  expectedPlanRequiresApproval: ${diagnostics.expectedPlanRequiresApproval ?? "none"}`,
    `  fixturePlanRequiresApproval: ${diagnostics.fixturePlanRequiresApproval ?? "none"}`,
    `  ${formatArray("planStepOrder", diagnostics.planStepOrder)}`,
    `  ${formatArray("missingApprovalStepIds", diagnostics.missingApprovalStepIds)}`,
    `  missingWritebackTargets: ${joinOrNone(formatMissingWritebackTargets(item))}`,
    `  ${formatArray("missingCompletedStepAttempts", diagnostics.missingCompletedStepAttempts)}`,
    `  ${formatArray("nonApprovedApprovalStepIds", diagnostics.nonApprovedApprovalStepIds)}`,
    `  writebackTargetsMissingStableMetadata: ${joinOrNone(formatMissingStableMetadata(item))}`,
  ];

  return lines.join("\n");
}

export function formatControlledTraceFixtureCatalogSummary(
  report: ControlledTraceFixtureCatalogReport,
) {
  const lines = [
    "Governed trace fixture replay summary",
    `Status: ${report.ok ? "OK" : "FAILED"}`,
    `Fixtures: ${report.total} total, ${report.passed} passed, ${report.failed} failed`,
    `Catalog: ${joinOrNone(report.fixtureIds)}`,
    `Playbooks: ${joinOrNone(report.playbookIds)}`,
    `Guarantees: toolCallsExecuted=${report.guarantees.toolCallsExecuted}, assetsWritten=${report.guarantees.assetsWritten}`,
  ];

  const failedItems = report.items.filter((item) => !item.ok);
  if (failedItems.length > 0) {
    lines.push("", "Failures:");
    lines.push(...failedItems.map(formatFailedItem));
  }

  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 2: Add CLI wrapper**

Create `scripts/trace-fixtures/catalog-summary.mjs`:

```js
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { formatControlledTraceFixtureCatalogSummary } from "@/__tests__/fixtures/controlled-traces/catalog-summary";

const report = buildControlledTraceFixtureCatalogReport();

process.stdout.write(formatControlledTraceFixtureCatalogSummary(report));

if (!report.ok) {
  process.exitCode = 1;
}
```

- [ ] **Step 3: Add package scripts**

Modify `package.json`:

```json
"trace:fixtures:summary": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/catalog-summary.mjs",
```

Also add `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts` to `test:controlled-runtime` after the existing catalog report script test.

- [ ] **Step 4: Run GREEN targeted test**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run both CLI commands**

Run:

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Expected:

- first command prints parseable JSON;
- second command prints the human-readable summary;
- both exit `0`.

- [ ] **Step 6: Commit implementation**

```bash
git add package.json scripts/trace-fixtures/catalog-summary.mjs src/__tests__/fixtures/controlled-traces/catalog-summary.ts src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts
git commit -m "test: add fixture replay summary cli"
```

## Task 3: Update Docs And Records

**Files:**
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update replay contract guide**

In command sequence, add:

```bash
npm run trace:fixtures:summary --silent
```

State that the summary command is the first local triage view, while `trace:fixtures` remains the machine-readable JSON output.

- [ ] **Step 2: Update refresh guide**

In catalog health section, add the summary command before JSON inspection:

```bash
npm run trace:fixtures:summary --silent
```

- [ ] **Step 3: Update Next Steps**

Mark `Fixture Replay Error Summary CLI` completed and set next phase to `Fixture Replay Failure Fixture Tests`.

- [ ] **Step 4: Update controlled runtime manual**

Add Phase 10m completion and set next phase to `Phase 10n. Fixture Replay Failure Fixture Tests`.

- [ ] **Step 5: Update changelog**

Add:

```md
### Fixture Replay Error Summary CLI

- Added `npm run trace:fixtures:summary` as a human-readable governed fixture replay summary command while keeping `npm run trace:fixtures` as stable JSON.
```

- [ ] **Step 6: Update local memory**

Record commits, verification, and next recommended phase. Do not force-add untracked memory.

- [ ] **Step 7: Commit docs**

```bash
git add docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md CHANGELOG.md
git commit -m "docs: complete fixture replay summary cli"
```

## Task 4: Final Verification

**Files:**
- No edits unless verification exposes a defect.

- [ ] **Step 1: Run summary commands**

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Expected: JSON command and text command both exit `0`.

- [ ] **Step 2: Run controlled runtime suite**

```bash
npm run test:controlled-runtime
```

Expected: all tests pass, including the new summary script test.

- [ ] **Step 3: Run core workflow suite**

```bash
npm run test:core-workflows
```

Expected: all regressions pass.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: exit 0. Existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` may still appear.

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: exit 0. Same existing warning may still appear.

- [ ] **Step 6: Run whitespace and status checks**

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0 and status shows only known unrelated untracked files.

## Rollback Checkpoint

- Starting checkpoint before implementation: `50ced12 docs: spec fixture replay summary cli`.
- Roll back this phase by reverting commits created after that checkpoint.
- No runtime stores, generated assets, browser sessions, external publishing, migrations, API routes, fixture discovery, or fixture refresh automation are part of this phase.
