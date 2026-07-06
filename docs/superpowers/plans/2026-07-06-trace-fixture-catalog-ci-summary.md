# Trace Fixture Catalog CI Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local command that prints governed trace fixture catalog health as compact JSON for maintainers and CI.

**Architecture:** Use the existing Node TypeScript alias loader to run a small `.mjs` script. The script consumes the Phase 10g `buildControlledTraceFixtureCatalogReport()` helper, emits a compact JSON summary, and sets a non-zero exit code if the report is not ok.

**Tech Stack:** Node.js, npm scripts, Vitest, existing `scripts/register-ts-alias-loader.mjs`, existing governed trace fixture catalog report helper.

---

## File Structure

- Create `scripts/trace-fixtures/catalog-report.mjs`: local JSON summary command.
- Create `src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts`: subprocess test for the npm command.
- Modify `package.json`: add `trace:fixtures` script.
- Modify docs and memory after verification.

---

### Task 1: CI Summary Command Test

**Files:**
- Create: `src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts`

- [x] **Step 1: Write failing subprocess test**

Create `src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts` with:

```ts
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type TraceFixtureCatalogSummaryOutput = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  failedItems: unknown[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};

describe("trace fixture catalog report script", () => {
  it("prints parseable catalog health JSON for committed governed fixtures", () => {
    const result = spawnSync("npm", ["run", "trace:fixtures", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as TraceFixtureCatalogSummaryOutput;
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
      },
    });
  });
});
```

- [x] **Step 2: Run script test to verify RED**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts
```

Expected: FAIL because `npm run trace:fixtures` is not defined.

---

### Task 2: Catalog Summary Script

**Files:**
- Create: `scripts/trace-fixtures/catalog-report.mjs`
- Modify: `package.json`

- [x] **Step 1: Add npm script**

In `package.json`, add this script near the other test scripts:

```json
"trace:fixtures": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/catalog-report.mjs",
```

- [x] **Step 2: Create summary script**

Create `scripts/trace-fixtures/catalog-report.mjs` with:

```js
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";

const report = buildControlledTraceFixtureCatalogReport();

const output = {
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

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
```

- [x] **Step 3: Run command manually**

Run:

```bash
npm run trace:fixtures --silent
```

Expected: exit 0 and stdout parseable JSON containing `"ok": true`, `"total": 2`, and `"failed": 0`.

- [x] **Step 4: Run script test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts
```

Expected: PASS.

- [x] **Step 5: Run fixture/report focused tests**

Run:

```bash
npm test -- src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: PASS.

- [x] **Step 6: Include script test in controlled runtime gate**

Modify `package.json` `test:controlled-runtime` to include:

```text
src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts
```

Place it after `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` in the existing command.

- [x] **Step 7: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS, with one additional test file and one additional test.

- [x] **Step 8: Commit command implementation**

```bash
git add package.json scripts/trace-fixtures/catalog-report.mjs src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts
git commit -m "test: add trace fixture catalog ci summary"
```

---

### Task 3: Verification, Docs, And Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-trace-fixture-catalog-ci-summary.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Run full verification before docs**

Run:

```bash
npm run trace:fixtures --silent
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `lint` and `build` may show only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [x] **Step 2: Update docs and records**

Record:

- script path;
- npm command;
- JSON output behavior;
- controlled runtime gate inclusion;
- continued pure metadata boundary;
- next recommended phase.

- [x] **Step 3: Re-run final verification after docs**

Run:

```bash
npm run trace:fixtures --silent
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with only the known existing `<img>` warning if present.

- [x] **Step 4: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-fixture-catalog-ci-summary.md
git commit -m "docs: complete trace fixture catalog ci summary"
```

---

## Plan Self-Review

- Spec coverage: local command, JSON output, exit code, npm script, subprocess test, controlled runtime gate, docs, and verification are covered.
- Placeholder scan: no placeholder markers remain.
- Type consistency: `trace:fixtures`, `scripts/trace-fixtures/catalog-report.mjs`, and `TraceFixtureCatalogSummaryOutput` are used consistently.

## Progress Record

- RED verified: `npm test -- src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts` failed because `npm run trace:fixtures` exited 1 before the script existed.
- Manual command verified: `npm run trace:fixtures --silent` printed parseable JSON with `ok: true`, `total: 2`, and `failed: 0`.
- GREEN verified: `npm test -- src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts` — 1 file / 1 test passed.
- Focused fixture/report tests verified: `npm test -- src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` — 4 files / 14 tests passed.
- Controlled runtime gate verified after inclusion: `npm run test:controlled-runtime` — 27 files / 148 tests passed.
- Implementation commit: `50e4be5 test: add trace fixture catalog ci summary`.
- Full verification before docs:
  - `npm run trace:fixtures --silent` — exit 0, `ok: true`, `total: 2`, `failed: 0`.
  - `npm run test:controlled-runtime` — 27 files / 148 tests passed.
  - `npm run test:core-workflows` — all core workflow regressions passed.
  - `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
  - `npm run build` — exit 0 with the same existing warning.
  - `git diff --check` — exit 0.
- Final verification after docs:
  - `npm run trace:fixtures --silent` — exit 0, `ok: true`, `total: 2`, `failed: 0`.
  - `npm run test:controlled-runtime` — 27 files / 148 tests passed.
  - `npm run test:core-workflows` — all core workflow regressions passed.
  - `npm run lint` — exit 0 with the existing `<img>` warning.
  - `npm run build` — exit 0 with the same existing warning.
  - `git diff --check` — exit 0.
