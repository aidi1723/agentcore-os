# Fixture Replay Failure Exit-Code Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a direct-invoked local harness that verifies failed governed fixture report and summary paths exit non-zero without making committed fixture commands fail.

**Architecture:** Extract the report JSON output shape into a test fixture helper shared by the committed JSON command and the failure harness. Add a harness script that builds a report from `buildCombinedSummaryFailureCatalogEntry()`, prints either JSON or summary output, and sets exit code 1 for the failed synthetic report. Add subprocess tests for JSON, summary, unknown format, and committed command green behavior.

**Tech Stack:** Node ESM scripts, TypeScript test fixture helpers loaded through `scripts/register-ts-alias-loader.mjs`, Vitest subprocess tests, existing governed trace fixture report/summary helpers.

---

## File Structure

- Create `src/__tests__/fixtures/controlled-traces/catalog-report-output.ts`: pure helper for the compact JSON command output contract.
- Modify `scripts/trace-fixtures/catalog-report.mjs`: use `buildControlledTraceFixtureCatalogReportOutput(report)`.
- Create `scripts/trace-fixtures/catalog-failure-harness.mjs`: direct-invoked synthetic failure harness for JSON and summary paths.
- Create `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts`: subprocess tests for failure exit behavior.
- Modify `package.json`: include the new test file in `test:controlled-runtime`.
- Modify docs after implementation:
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `memory/2026-07-06.md`

## Task 1: Write Failing Harness Tests

**Files:**
- Create: `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add subprocess tests for synthetic failed JSON and summary output**

Create `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runHarness(format: string) {
  return spawnSync(
    "node",
    [
      "--import",
      "./scripts/register-ts-alias-loader.mjs",
      "./scripts/trace-fixtures/catalog-failure-harness.mjs",
      "--format",
      format,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

describe("trace fixture catalog failure harness script", () => {
  it("exits non-zero with parseable failed JSON output", () => {
    const result = runHarness("json");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      total: number;
      passed: number;
      failed: number;
      fixtureIds: string[];
      failedItems: Array<{
        catalogId: string;
        replayErrors: string[];
        diagnostics: {
          expectedPlaybookVersion?: string;
          fixturePlaybookVersion: string;
          writebackTargetsMissingStableMetadata: Array<{
            stepId: string;
            target: string;
            missingFields: string[];
          }>;
        };
      }>;
      guarantees: {
        toolCallsExecuted: false;
        assetsWritten: false;
      };
    };

    expect(output).toMatchObject({
      ok: false,
      total: 1,
      passed: 0,
      failed: 1,
      fixtureIds: ["sales-pipeline-summary-drift"],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    });
    expect(output.failedItems[0].catalogId).toBe("sales-pipeline-summary-drift");
    expect(output.failedItems[0].replayErrors).toContain(
      "Fixture playbook version does not match current playbook sales-pipeline-v1",
    );
    expect(output.failedItems[0].replayErrors).toContain(
      "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
    );
    expect(output.failedItems[0].diagnostics).toMatchObject({
      expectedPlaybookVersion: "1.0.0",
      fixturePlaybookVersion: "0.9.0",
    });
    expect(
      output.failedItems[0].diagnostics.writebackTargetsMissingStableMetadata,
    ).toContainEqual({
      stepId: "writeback",
      target: "sales_asset",
      missingFields: ["sourceKey"],
    });
  });

  it("exits non-zero with failed human-readable summary output", () => {
    const result = runHarness("summary");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");
    expect(result.stdout).toContain("Status: FAILED");
    expect(result.stdout).toContain("Fixtures: 1 total, 0 passed, 1 failed");
    expect(result.stdout).toContain("Failed fixture: sales-pipeline-summary-drift");
    expect(result.stdout).toContain(
      "Fixture playbook version does not match current playbook sales-pipeline-v1",
    );
    expect(result.stdout).toContain(
      "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
    );
  });

  it("exits non-zero with stable usage text for unknown formats", () => {
    const result = runHarness("xml");

    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe("");
    expect(result.stderr.trim()).toBe(
      "Usage: catalog-failure-harness.mjs --format json|summary",
    );
  });

  it("keeps committed fixture commands green", () => {
    const jsonResult = spawnSync("npm", ["run", "trace:fixtures", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const summaryResult = spawnSync("npm", ["run", "trace:fixtures:summary", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(jsonResult.status).toBe(0);
    expect(jsonResult.stderr.trim()).toBe("");
    expect(JSON.parse(jsonResult.stdout)).toMatchObject({
      ok: true,
      total: 2,
      failed: 0,
    });

    expect(summaryResult.status).toBe(0);
    expect(summaryResult.stderr.trim()).toBe("");
    expect(summaryResult.stdout).toContain("Status: OK");
  });
});
```

- [ ] **Step 2: Include the test in the controlled runtime script**

Add `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts` to `test:controlled-runtime` in `package.json` after `trace-fixture-catalog-summary-script.test.ts`.

- [ ] **Step 3: Run RED test**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts
```

Expected: FAIL because `scripts/trace-fixtures/catalog-failure-harness.mjs` does not exist.

## Task 2: Implement Report Output Helper And Harness

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/catalog-report-output.ts`
- Modify: `scripts/trace-fixtures/catalog-report.mjs`
- Create: `scripts/trace-fixtures/catalog-failure-harness.mjs`

- [ ] **Step 1: Extract compact JSON output helper**

Create `src/__tests__/fixtures/controlled-traces/catalog-report-output.ts`:

```ts
import type { ControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";

export function buildControlledTraceFixtureCatalogReportOutput(
  report: ControlledTraceFixtureCatalogReport,
) {
  return {
    ok: report.ok,
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    fixtureIds: report.fixtureIds,
    playbookIds: report.playbookIds,
    failedItems: report.items
      .filter((item) => !item.ok)
      .map((item) => ({
        catalogId: item.catalogId,
        fixtureId: item.fixtureId,
        playbookId: item.playbookId,
        validationErrors: item.validation.errors,
        replayErrors: item.replay.errors,
        diagnostics: item.replay.diagnostics,
      })),
    guarantees: report.guarantees,
  };
}
```

- [ ] **Step 2: Refactor committed JSON command to use the helper**

Replace the inline `output` object in `scripts/trace-fixtures/catalog-report.mjs` with:

```js
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { buildControlledTraceFixtureCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/catalog-report-output";

const report = buildControlledTraceFixtureCatalogReport();
const output = buildControlledTraceFixtureCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
```

- [ ] **Step 3: Add synthetic failure harness**

Create `scripts/trace-fixtures/catalog-failure-harness.mjs`:

```js
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { buildControlledTraceFixtureCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/catalog-report-output";
import { formatControlledTraceFixtureCatalogSummary } from "@/__tests__/fixtures/controlled-traces/catalog-summary";
import { buildCombinedSummaryFailureCatalogEntry } from "@/__tests__/fixtures/controlled-traces/synthetic-failures";

function readFormatArg(argv) {
  const formatIndex = argv.indexOf("--format");
  if (formatIndex === -1) return null;
  return argv[formatIndex + 1] ?? null;
}

const format = readFormatArg(process.argv.slice(2));
const report = buildControlledTraceFixtureCatalogReport([
  buildCombinedSummaryFailureCatalogEntry(),
]);

if (format === "json") {
  const output = buildControlledTraceFixtureCatalogReportOutput(report);
  console.log(JSON.stringify(output, null, 2));
} else if (format === "summary") {
  process.stdout.write(formatControlledTraceFixtureCatalogSummary(report));
} else {
  process.stderr.write("Usage: catalog-failure-harness.mjs --format json|summary\n");
  process.exitCode = 1;
}

if (!report.ok && process.exitCode === undefined) {
  process.exitCode = 1;
}
```

- [ ] **Step 4: Run GREEN targeted test**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 5: Run committed fixture commands**

Run:

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Expected:

- JSON command exits 0 and prints `ok: true`, `total: 2`, `failed: 0`;
- summary command exits 0 and prints `Status: OK`.

- [ ] **Step 6: Commit harness implementation**

Run:

```bash
git add src/__tests__/fixtures/controlled-traces/catalog-report-output.ts scripts/trace-fixtures/catalog-report.mjs scripts/trace-fixtures/catalog-failure-harness.mjs src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts package.json
git commit -m "test: add fixture replay failure exit harness"
```

## Task 3: Docs, Records, And Verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update project docs and local memory**

Record Phase 10o as completed:

- direct-invoked failure harness added;
- JSON and summary synthetic failed outputs exit non-zero;
- committed fixture commands remain green;
- report JSON output shape is shared through `catalog-report-output.ts`.

Set next recommended phase to:

```text
Phase 10p. Fixture Replay Validation Failure Fixtures
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
git commit -m "docs: complete fixture replay failure exit harness"
```

Do not add `memory/2026-07-06.md`; it is local continuity.

## Self-Review

- Spec coverage: Tasks cover the JSON helper, direct harness, non-zero JSON and summary behavior, unknown format behavior, committed command green behavior, docs, and verification.
- Placeholder scan: No deferred implementation language is used.
- Type consistency: The helper consumes `ControlledTraceFixtureCatalogReport`; harness and committed JSON command both call `buildControlledTraceFixtureCatalogReportOutput(report)`.
