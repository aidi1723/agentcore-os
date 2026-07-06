# Replay Sandbox Failure Harness Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct replay sandbox failure harness modes for contract, sandbox, and guarantee failures while keeping committed fixture commands green.

**Architecture:** Keep synthetic failures inside the existing test-only harness script. Extend subprocess tests first so the current single-mode harness fails RED, then add a small mode dispatcher that reuses the Phase 10ac report/output helpers and taxonomy.

**Tech Stack:** Node ESM script, TypeScript/Vitest subprocess tests, existing replay sandbox catalog report helpers, existing `test:controlled-runtime`.

---

## File Structure

- Modify `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`
  - Add subprocess coverage for `contract`, `sandbox`, `guarantee`, and unknown modes.
- Modify `scripts/trace-fixtures/replay-sandbox-failure-harness.mjs`
  - Add optional mode argument and direct synthetic report builders.
- Modify docs after implementation:
  - `CHANGELOG.md`
  - `README.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `docs/NEXT_STEPS.md`
  - `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - `docs/ROADMAP.md`
  - this plan
  - `memory/2026-07-06.md`

---

### Task 1: Add Failing Harness Mode Tests

**Files:**
- Modify: `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`

- [ ] **Step 1: Extend the subprocess helper**

Change `runFailureHarness()` to accept an optional mode:

```ts
function runFailureHarness(mode?: string) {
  return spawnSync(
    "node",
    [
      "--import",
      "./scripts/register-ts-alias-loader.mjs",
      "./scripts/trace-fixtures/replay-sandbox-failure-harness.mjs",
      ...(mode ? [mode] : []),
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}
```

- [ ] **Step 2: Keep the default contract failure assertion**

Keep the existing no-argument harness test and rename it to:

```ts
  it("defaults to contract failure mode with parseable failed replay sandbox JSON output", () => {
```

The body should continue to expect:

```ts
failureKind: "contract_build_failed",
contractBuildOk: false,
artifactStatus: null,
guaranteeErrors: [],
```

- [ ] **Step 3: Add explicit contract mode coverage**

Add a test:

```ts
  it("supports explicit contract failure mode", () => {
    const result = runFailureHarness("contract");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output.failedItems[0]).toMatchObject({
      failureKind: "contract_build_failed",
      contractBuildOk: false,
      artifactStatus: null,
      guaranteeErrors: [],
    });
  });
```

- [ ] **Step 4: Add sandbox artifact failure mode coverage**

Add a test:

```ts
  it("supports sandbox artifact failure mode", () => {
    const result = runFailureHarness("sandbox");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output).toMatchObject({
      ok: false,
      total: 1,
      passed: 0,
      failed: 1,
      fixtureIds: ["sales-pipeline-governed"],
      playbookIds: ["sales-pipeline-v1"],
    });
    expect(output.failedItems[0]).toMatchObject({
      catalogId: "sales-pipeline-governed",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      failureKind: "sandbox_artifact_failed",
      contractBuildOk: true,
      artifactStatus: "failed",
      artifactDiagnostics: ["Synthetic sandbox preflight rejection"],
      guaranteeErrors: [],
      errors: ["Synthetic sandbox preflight rejection"],
    });
  });
```

- [ ] **Step 5: Add guarantee violation failure mode coverage**

Add a test:

```ts
  it("supports guarantee violation failure mode", () => {
    const result = runFailureHarness("guarantee");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output.failedItems[0]).toMatchObject({
      catalogId: "sales-pipeline-governed",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      failureKind: "guarantee_violation",
      contractBuildOk: true,
      artifactStatus: "succeeded",
      artifactDiagnostics: ["Synthetic replay completed"],
      guaranteeErrors: ["Replay sandbox no-side-effect guarantees were not preserved"],
      errors: ["Replay sandbox no-side-effect guarantees were not preserved"],
    });
  });
```

- [ ] **Step 6: Add unknown mode guard coverage**

Add a test:

```ts
  it("rejects unknown failure harness modes without report JSON", () => {
    const result = runFailureHarness("unknown");

    expect(result.status).toBe(2);
    expect(result.stdout.trim()).toBe("");
    expect(result.stderr.trim()).toBe(
      "Unsupported replay sandbox failure harness mode: unknown. Supported modes: contract, sandbox, guarantee.",
    );
  });
```

- [ ] **Step 7: Run tests and verify RED**

Run:

```bash
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Expected: FAIL because `sandbox`, `guarantee`, and unknown mode behavior are not implemented.

- [ ] **Step 8: Commit failing tests**

```bash
git add src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
git diff --check --cached
git commit -m "test: specify replay sandbox failure harness modes"
```

---

### Task 2: Implement Harness Mode Dispatcher

**Files:**
- Modify: `scripts/trace-fixtures/replay-sandbox-failure-harness.mjs`

- [ ] **Step 1: Add artifact builder import**

Add:

```js
import { buildNoSideEffectReplayResultArtifact } from "@/lib/executor/runtime/replay-sandbox-contracts";
```

- [ ] **Step 2: Add mode parsing and guard**

Add near the top after imports:

```js
const supportedModes = ["contract", "sandbox", "guarantee"];
const mode = process.argv[2] ?? "contract";

if (!supportedModes.includes(mode)) {
  console.error(
    `Unsupported replay sandbox failure harness mode: ${mode}. Supported modes: ${supportedModes.join(", ")}.`,
  );
  process.exit(2);
}
```

- [ ] **Step 3: Extract contract failure report builder**

Replace the current top-level fixture mutation/report creation with:

```js
function buildContractFailureReport() {
  const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
  fixture.sourceRunId = "";
  fixture.playbookVersion = "";
  fixture.assertions.redactionBoundary = "optional";

  return buildReplaySandboxCatalogReport([
    {
      id: "sales-pipeline-replay-sandbox-broken-contract",
      playbookId: "sales-pipeline-v1",
      fixture,
    },
  ]);
}
```

- [ ] **Step 4: Add sandbox artifact failure report builder**

Add:

```js
function buildSandboxArtifactFailureReport() {
  return buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
    runSandbox: (contract) =>
      buildNoSideEffectReplayResultArtifact(contract, {
        status: "failed",
        cursorEvents: ["preflight"],
        diagnostics: ["Synthetic sandbox preflight rejection"],
      }),
  });
}
```

- [ ] **Step 5: Add guarantee violation report builder**

Add:

```js
function buildGuaranteeViolationReport() {
  return buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
    runSandbox: (contract) => ({
      ...buildNoSideEffectReplayResultArtifact(contract, {
        status: "succeeded",
        diagnostics: ["Synthetic replay completed"],
      }),
      guarantees: {
        toolCallsExecuted: true,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    }),
  });
}
```

- [ ] **Step 6: Dispatch by mode and print output**

Add:

```js
const report =
  mode === "contract"
    ? buildContractFailureReport()
    : mode === "sandbox"
      ? buildSandboxArtifactFailureReport()
      : buildGuaranteeViolationReport();
const output = buildReplaySandboxCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
```

- [ ] **Step 7: Run targeted tests and verify GREEN**

Run:

```bash
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Expected: PASS.

- [ ] **Step 8: Verify committed fixture command remains green**

Run:

```bash
npm run replay:sandbox:fixtures --silent
```

Expected: exit 0, `ok: true`, `failedItems: []`.

- [ ] **Step 9: Commit implementation**

```bash
git add scripts/trace-fixtures/replay-sandbox-failure-harness.mjs
git diff --check --cached
git commit -m "feat: expand replay sandbox failure harness modes"
```

---

### Task 3: Controlled Runtime Gate

**Files:**
- No source file changes expected unless the test command list changes.

- [ ] **Step 1: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the previous 35 files plus the additional harness mode tests.

- [ ] **Step 2: Commit package changes if needed**

No commit is expected unless `package.json` changes.

---

### Task 4: Align Documentation And Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/superpowers/plans/2026-07-06-replay-sandbox-failure-harness-expansion.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Mark this plan complete**

Update checkboxes and add completion notes with commits and verification evidence.

- [ ] **Step 2: Update project docs**

Record the new capability as:

```text
Replay sandbox failure harness direct modes for contract, sandbox, and guarantee failures.
```

Set the next recommended phase to:

```text
Governed Fixture And Playbook Expansion Review
```

- [ ] **Step 3: Update daily memory**

Append a concise record to `memory/2026-07-06.md` with phase name, files changed, commits, verification, and next phase.

- [ ] **Step 4: Run final verification**

Run:

```bash
git diff --check
npm run replay:sandbox:fixtures --silent
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit docs and records**

```bash
git add CHANGELOG.md README.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/NEXT_STEPS.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/ROADMAP.md docs/superpowers/plans/2026-07-06-replay-sandbox-failure-harness-expansion.md
git diff --check --cached
git commit -m "docs: complete replay sandbox failure harness expansion"
```

---

## Final Verification Checklist

- [ ] `git diff --check`
- [ ] `npm run replay:sandbox:fixtures --silent`
- [ ] `npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`
- [ ] `npm run trace:fixtures --silent`
- [ ] `npm run trace:fixtures:summary --silent`
- [ ] `npm run test:controlled-runtime`
- [ ] `npm run test:core-workflows`

## Expected Next Phase

Governed Fixture And Playbook Expansion Review: inspect whether current sales/support governed fixtures are sufficient before adding any new fixture JSON or playbook migration.
