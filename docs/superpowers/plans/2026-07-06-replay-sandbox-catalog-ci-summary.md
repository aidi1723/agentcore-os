# Replay Sandbox Catalog CI Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local compact JSON command that reports replay sandbox catalog health and exits non-zero on report failure.

**Architecture:** Reuse the existing replay sandbox catalog report helper, add a small compact-output adapter, expose a default committed-catalog script through npm, and add a direct test-only failure harness to prove non-zero exit behavior without adding failing committed fixture JSON. Scripts remain pure module composition with no routes, stores, tools, LLM calls, fixture mutation, or asset writes.

**Tech Stack:** TypeScript, Node ESM scripts, Vitest subprocess tests, existing TypeScript alias loader, existing replay sandbox catalog report helper, existing `test:controlled-runtime`.

---

## File Structure

- Create `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`
  - Failing subprocess tests for the new npm command and direct failure harness.
- Create `src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts`
  - Compact JSON output adapter for `ReplaySandboxCatalogReport`.
- Create `scripts/trace-fixtures/replay-sandbox-catalog-report.mjs`
  - Default committed-catalog JSON command.
- Create `scripts/trace-fixtures/replay-sandbox-failure-harness.mjs`
  - Direct test-only failed report harness.
- Modify `package.json`
  - Add `replay:sandbox:fixtures`.
  - Add the new subprocess test to `test:controlled-runtime`.
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
  - `docs/superpowers/plans/2026-07-06-replay-sandbox-catalog-ci-summary.md`
  - `memory/2026-07-06.md`

---

### Task 1: Add Failing CLI Tests

**Files:**
- Create: `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`

- [x] **Step 1: Write failing subprocess tests**

Create `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type ReplaySandboxCatalogSummaryOutput = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  failedItems: Array<{
    catalogId: string;
    fixtureId: string;
    playbookId: string;
    contractBuildOk: boolean;
    contractErrors: string[];
    artifactStatus: "succeeded" | "failed" | null;
    artifactDiagnostics: string[];
    errors: string[];
  }>;
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
    runtimeStoresMutated: false;
    productionCredentialsUsed: false;
  };
};

function runFailureHarness() {
  return spawnSync(
    "node",
    [
      "--import",
      "./scripts/register-ts-alias-loader.mjs",
      "./scripts/trace-fixtures/replay-sandbox-failure-harness.mjs",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

describe("replay sandbox catalog report script", () => {
  it("prints parseable replay sandbox catalog health JSON", () => {
    const result = spawnSync("npm", ["run", "replay:sandbox:fixtures", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output).toMatchObject({
      ok: true,
      total: 2,
      passed: 2,
      failed: 0,
      fixtureIds: ["sales-pipeline-governed", "support-resolution-governed"],
      playbookIds: ["sales-pipeline-v1", "support-resolution-v1"],
      failedItems: [],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
  });

  it("exits non-zero with parseable failed replay sandbox JSON output", () => {
    const result = runFailureHarness();

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output).toMatchObject({
      ok: false,
      total: 1,
      passed: 0,
      failed: 1,
      fixtureIds: ["sales-pipeline-replay-sandbox-broken-contract"],
      playbookIds: ["sales-pipeline-v1"],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
    expect(output.failedItems[0]).toMatchObject({
      catalogId: "sales-pipeline-replay-sandbox-broken-contract",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      contractBuildOk: false,
      artifactStatus: null,
      artifactDiagnostics: [],
    });
    expect(output.failedItems[0].contractErrors).toEqual([
      "Fixture sourceRunId is required",
      "Fixture playbookVersion is required",
      "Fixture redaction boundary is required",
      "Replay input playbookVersion is required",
      "Replay input redaction boundary is required",
    ]);
    expect(output.failedItems[0].errors).toEqual(
      output.failedItems[0].contractErrors,
    );
  });
});
```

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Expected: FAIL because the new npm script and harness do not exist.

- [x] **Step 3: Commit failing tests**

```bash
git add src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
git diff --check --cached
git commit -m "test: specify replay sandbox catalog summary command"
```

---

### Task 2: Add Compact Output Helper And Scripts

**Files:**
- Create: `src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts`
- Create: `scripts/trace-fixtures/replay-sandbox-catalog-report.mjs`
- Create: `scripts/trace-fixtures/replay-sandbox-failure-harness.mjs`

- [x] **Step 1: Add compact output helper**

Create `src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts`:

```ts
import type { ReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";

export function buildReplaySandboxCatalogReportOutput(
  report: ReplaySandboxCatalogReport,
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
        contractBuildOk: item.contractBuild.ok,
        contractErrors: item.contractBuild.ok ? [] : item.contractBuild.errors,
        artifactStatus: item.artifact?.status ?? null,
        artifactDiagnostics: item.artifact?.diagnostics ?? [],
        errors: item.errors,
      })),
    guarantees: report.guarantees,
  };
}
```

- [x] **Step 2: Add committed-catalog command script**

Create `scripts/trace-fixtures/replay-sandbox-catalog-report.mjs`:

```js
import { buildReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";
import { buildReplaySandboxCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report-output";

const report = buildReplaySandboxCatalogReport();
const output = buildReplaySandboxCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
```

- [x] **Step 3: Add failed-report harness**

Create `scripts/trace-fixtures/replay-sandbox-failure-harness.mjs`:

```js
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";
import { buildReplaySandboxCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report-output";

const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
fixture.sourceRunId = "";
fixture.playbookVersion = "";
fixture.assertions.redactionBoundary = "optional";

const report = buildReplaySandboxCatalogReport([
  {
    id: "sales-pipeline-replay-sandbox-broken-contract",
    playbookId: "sales-pipeline-v1",
    fixture,
  },
]);
const output = buildReplaySandboxCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
```

- [x] **Step 4: Run targeted test before package script**

Run:

```bash
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Expected: still FAIL because `npm run replay:sandbox:fixtures` does not exist, while direct harness resolution should now work.

- [x] **Step 5: Commit helper and scripts**

```bash
git add src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts scripts/trace-fixtures/replay-sandbox-catalog-report.mjs scripts/trace-fixtures/replay-sandbox-failure-harness.mjs
git diff --check --cached
git commit -m "feat: add replay sandbox catalog summary scripts"
```

---

### Task 3: Add Package Script And Controlled Runtime Gate

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add npm script**

Add to `scripts`:

```json
"replay:sandbox:fixtures": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/replay-sandbox-catalog-report.mjs"
```

- [x] **Step 2: Add new test to `test:controlled-runtime`**

Insert:

```text
src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

after:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
```

- [x] **Step 3: Run the new command**

Run:

```bash
npm run replay:sandbox:fixtures --silent
```

Expected: exit 0 with parseable JSON, `ok: true`, `total: 2`, `failed: 0`.

- [x] **Step 4: Run targeted script test and controlled runtime gate**

Run:

```bash
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
npm run test:controlled-runtime
```

Expected:

- targeted script test passes with 1 file / 2 tests;
- controlled runtime gate passes with one more file and two more tests than the previous 34 files / 179 tests baseline; observed 35 files / 181 tests.

- [x] **Step 5: Commit package/gate update**

```bash
git add package.json
git diff --check --cached
git commit -m "test: include replay sandbox catalog summary command"
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
- Modify: `docs/superpowers/plans/2026-07-06-replay-sandbox-catalog-ci-summary.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Mark this plan complete**

Update this plan's task checkboxes and add completion notes with commits and
verification evidence.

- [x] **Step 2: Update project docs**

Record the new capability as:

```text
Replay sandbox catalog CI summary command for committed governed fixtures.
```

Also update the controlled runtime baseline to the observed result from
`npm run test:controlled-runtime`.

Set the next recommended phase to:

```text
Replay Sandbox Failure Diagnostics Hardening
```

- [x] **Step 3: Update daily memory**

Append a concise record to `memory/2026-07-06.md` with:

- phase name;
- files added;
- commits;
- verification commands and observed results;
- next recommended phase.

- [x] **Step 4: Run final verification**

Run:

```bash
git diff --check
npm run replay:sandbox:fixtures --silent
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

Expected: all commands exit 0.

- [x] **Step 5: Commit docs and records**

```bash
git add CHANGELOG.md README.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md docs/ROADMAP.md docs/superpowers/plans/2026-07-06-replay-sandbox-catalog-ci-summary.md
git diff --check --cached
git commit -m "docs: complete replay sandbox catalog ci summary"
```

---

## Final Verification Checklist

- [x] `git diff --check`
- [x] `npm run replay:sandbox:fixtures --silent`
- [x] `npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`
- [x] `npm run trace:fixtures --silent`
- [x] `npm run trace:fixtures:summary --silent`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`

## Completion Notes

- Completed on: 2026-07-06
- Commits:
  - `0ad4df9` - `docs: spec replay sandbox catalog ci summary`
  - `32d3512` - `docs: plan replay sandbox catalog ci summary`
  - `139b864` - `test: specify replay sandbox catalog summary command`
  - `a1719fa` - `feat: add replay sandbox catalog summary scripts`
  - `88d834c` - `test: include replay sandbox catalog summary command`
- TDD evidence:
  - RED: `npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts` failed because the npm script and failure harness did not exist.
  - GREEN: `npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts` passed with 1 file / 2 tests.
- Debugging note:
  - Node ESM script execution could not resolve extensionless relative imports in replay sandbox runtime modules.
  - Updated replay sandbox runtime imports to use existing `@/lib/...` alias paths, matching script-compatible runtime modules such as `trace-replay.ts`.
- Final verification:
  - `git diff --check` - exit 0
  - `npm run replay:sandbox:fixtures --silent` - ok true; 2 total / 2 passed / 0 failed
  - `npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts` - 1 file / 2 tests passed
  - `npm run trace:fixtures --silent` - ok true; 2 total / 2 passed / 0 failed
  - `npm run trace:fixtures:summary --silent` - Status OK
  - `npm run test:controlled-runtime` - 35 files / 181 tests passed
  - `npm run test:core-workflows` - all core workflow regressions passed
- Outcome: Phase 10ab is complete. The next recommended phase is Replay Sandbox Failure Diagnostics Hardening.

## Expected Next Phase

Replay Sandbox Failure Diagnostics Hardening: add reusable synthetic sandbox /
contract failure coverage so future CLI diagnostics stay stable without adding
failing committed fixture JSON.
