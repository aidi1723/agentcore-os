# Governed Fixture To Replay Sandbox Contract Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure helper that converts governed trace fixture metadata into `ReplaySandboxContract` for the no-side-effect replay sandbox prototype.

**Architecture:** Add `replay-sandbox-fixture-contract.ts` beside the existing replay sandbox runtime modules. The helper accepts a `ControlledTraceFixture`, validates fixture/provenance/redaction metadata, derives fixture approval decisions, validates the resulting replay sandbox contract, and returns a structured success/failure result without touching files, routes, stores, tools, UI, or business assets.

**Tech Stack:** TypeScript, Vitest, existing governed trace fixture types/catalog, existing replay sandbox contracts, existing no-side-effect replay sandbox prototype, existing `test:controlled-runtime`.

---

## File Structure

- Create `src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts`
  - Failing tests for fixture -> contract mapping, catalog fixture compatibility, rejection behavior, and sandbox artifact guarantees.
- Create `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts`
  - Pure bridge implementation and result types.
- Modify `package.json`
  - Include the new test file in `test:controlled-runtime`.
- Modify docs after implementation:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - `docs/NEXT_STEPS.md`
  - `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - `docs/ROADMAP.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`
  - `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
  - `docs/superpowers/plans/2026-07-06-governed-fixture-to-replay-sandbox-contract-bridge.md`

---

### Task 1: Add Failing Bridge Tests

**Files:**
- Create: `src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts`

- [x] **Step 1: Write the failing tests**

Create `src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildReplaySandboxContractFromFixture } from "@/lib/executor/runtime/replay-sandbox-fixture-contract";
import { runNoSideEffectReplaySandbox } from "@/lib/executor/runtime/replay-sandbox";

describe("replay sandbox fixture contract bridge", () => {
  it("converts a governed sales fixture into a valid replay sandbox contract", () => {
    const fixture = controlledTraceFixtureCatalog[0].fixture;
    const result = buildReplaySandboxContractFromFixture(fixture, {
      replayId: "replay-sales-fixture",
      sandboxId: "sandbox-sales-fixture",
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
      contract: {
        replayId: "replay-sales-fixture",
        sandboxId: "sandbox-sales-fixture",
        mode: "no_side_effect_prototype",
        input: {
          kind: "committed_fixture",
          sourceId: "controlled-trace-fixture:run-fixture-1",
          playbookId: "sales-pipeline-v1",
          playbookVersion: "1.0.0",
          scenarioId: "sales-pipeline",
          generatedAt: 300,
          governanceMode: "fixture",
          redactionBoundary: "required",
        },
        credentialPolicy: {
          mode: "fixture",
        },
        approvalPolicy: {
          mode: "fixture_derived",
          simulatedDecisions: [
            {
              stepId: "human_review",
              decision: "approved",
            },
          ],
        },
        storePolicy: {
          mode: "fixture_only",
          requestedStores: [],
        },
        sideEffectPolicy: {
          allowedOutput: "replay_result_artifact",
          blocked: [],
        },
      },
    });
  });

  it("builds sandbox-accepted contracts from every committed governed fixture", () => {
    const artifacts = controlledTraceFixtureCatalog.map((entry) => {
      const result = buildReplaySandboxContractFromFixture(entry.fixture);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join("; "));

      return runNoSideEffectReplaySandbox(result.contract);
    });

    expect(artifacts.map((artifact) => artifact.status)).toEqual([
      "succeeded",
      "succeeded",
    ]);
    expect(artifacts.map((artifact) => artifact.source.playbookId)).toEqual([
      "sales-pipeline-v1",
      "support-resolution-v1",
    ]);
    for (const artifact of artifacts) {
      expect(artifact.guarantees).toEqual({
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      });
    }
  });

  it("rejects broken fixture provenance and redaction boundaries", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.sourceRunId = "";
    fixture.playbookVersion = "";
    fixture.assertions.redactionBoundary = "optional" as "required";

    const result = buildReplaySandboxContractFromFixture(fixture);

    expect(result).toEqual({
      ok: false,
      errors: [
        "Fixture sourceRunId is required",
        "Fixture playbookVersion is required",
        "Fixture redaction boundary is required",
        "Replay input redaction boundary is required",
      ],
    });
  });
});
```

- [x] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts
```

Expected: FAIL because `@/lib/executor/runtime/replay-sandbox-fixture-contract` does not exist.

- [x] **Step 3: Commit failing tests**

```bash
git add src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts
git diff --check --cached
git commit -m "test: specify fixture replay sandbox contract bridge"
```

---

### Task 2: Implement The Fixture Contract Bridge

**Files:**
- Create: `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts`

- [x] **Step 1: Add the pure bridge implementation**

Create `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts`:

```ts
import type { ControlledTraceFixture } from "./trace-fixtures";
import { validateControlledTraceFixture } from "./trace-fixtures";
import {
  type ReplayApprovalMode,
  type ReplaySandboxContract,
  validateReplaySandboxContract,
} from "./replay-sandbox-contracts";

export type ReplaySandboxContractBuildResult =
  | {
      ok: true;
      errors: [];
      contract: ReplaySandboxContract;
    }
  | {
      ok: false;
      errors: string[];
    };

type BuildReplaySandboxContractFromFixtureOptions = {
  replayId?: string;
  sandboxId?: string;
};

function deriveApprovalDecisions(fixture: ControlledTraceFixture) {
  return fixture.steps.flatMap((step) => {
    if (step.approvalState === "approved" || step.approvalState === "rejected") {
      return [
        {
          stepId: step.stepId,
          decision: step.approvalState,
        },
      ];
    }
    return [];
  });
}

function validateFixtureContractInput(fixture: ControlledTraceFixture) {
  const errors = validateControlledTraceFixture(fixture).errors;

  if (!fixture.fixtureId) errors.push("Fixture fixtureId is required");
  if (!fixture.sourceRunId) errors.push("Fixture sourceRunId is required");
  if (!fixture.playbookId) errors.push("Fixture playbookId is required");
  if (!fixture.playbookVersion) errors.push("Fixture playbookVersion is required");
  if (!fixture.scenarioId) errors.push("Fixture scenarioId is required");
  if (typeof fixture.generatedAt !== "number") {
    errors.push("Fixture generatedAt must be a number");
  }
  if (fixture.governance.mode !== "fixture" && fixture.governance.mode !== "audit") {
    errors.push(`Fixture governance mode ${fixture.governance.mode} is not allowed`);
  }
  if (fixture.assertions.redactionBoundary !== "required") {
    errors.push("Fixture redaction boundary is required");
  }

  return errors;
}

export function buildReplaySandboxContractFromFixture(
  fixture: ControlledTraceFixture,
  options: BuildReplaySandboxContractFromFixtureOptions = {},
): ReplaySandboxContractBuildResult {
  const inputErrors = validateFixtureContractInput(fixture);
  const contract: ReplaySandboxContract = {
    replayId: options.replayId ?? `replay:${fixture.fixtureId}`,
    sandboxId: options.sandboxId ?? `sandbox:${fixture.fixtureId}`,
    mode: "no_side_effect_prototype",
    input: {
      kind: "committed_fixture",
      sourceId: fixture.fixtureId,
      playbookId: fixture.playbookId,
      playbookVersion: fixture.playbookVersion,
      scenarioId: fixture.scenarioId ?? "",
      generatedAt: fixture.generatedAt,
      governanceMode: fixture.governance.mode,
      redactionBoundary: fixture.assertions.redactionBoundary,
    },
    credentialPolicy: {
      mode: "fixture",
    },
    approvalPolicy: {
      mode: "fixture_derived" satisfies ReplayApprovalMode,
      simulatedDecisions: deriveApprovalDecisions(fixture),
    },
    storePolicy: {
      mode: "fixture_only",
      requestedStores: [],
    },
    sideEffectPolicy: {
      allowedOutput: "replay_result_artifact",
      blocked: [],
    },
  };
  const contractValidation = validateReplaySandboxContract(contract);
  const errors = [...inputErrors, ...contractValidation.errors];

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: [],
    contract,
  };
}
```

- [x] **Step 2: Run targeted tests and verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts src/__tests__/lib/executor/runtime/replay-sandbox.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts
```

Expected: PASS, 3 files.

- [x] **Step 3: Commit implementation**

```bash
git add src/lib/executor/runtime/replay-sandbox-fixture-contract.ts
git diff --check --cached
git commit -m "feat: bridge governed fixtures to replay sandbox contracts"
```

---

### Task 3: Include Bridge In Controlled Runtime Gate

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add the bridge test to `test:controlled-runtime`**

In `package.json`, add this path immediately after `src/__tests__/lib/executor/runtime/replay-sandbox.test.ts`:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts
```

- [x] **Step 2: Run the controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the new bridge test included.

- [x] **Step 3: Commit the gate update**

```bash
git add package.json
git diff --check --cached
git commit -m "test: include fixture contract bridge in controlled runtime"
```

---

### Task 4: Align Documentation And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`
- Modify: `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-governed-fixture-to-replay-sandbox-contract-bridge.md`

- [x] **Step 1: Update current docs**

Record this phase as completed and set the next recommended phase to
catalog-level replay sandbox report.

The docs must state:

- `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts` now exists.
- `buildReplaySandboxContractFromFixture()` converts committed fixture metadata
  into `ReplaySandboxContract`.
- The bridge rejects missing provenance and redaction-boundary failures.
- Current committed sales/support fixtures can now flow through
  `fixture -> contract -> no-side-effect replay artifact`.
- The next phase should add a catalog-level sandbox report, still without real
  replay, route calls, store reads/writes, fixture JSON changes, or asset writes.

- [x] **Step 2: Run final verification**

Run:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

Expected:

- whitespace check exits 0;
- fixture replay JSON reports `ok: true`;
- fixture summary reports `Status: OK`;
- controlled runtime tests pass;
- core workflow regressions pass.

- [x] **Step 3: Mark this plan complete**

Update all checkboxes to `- [x]` and add completion notes with exact verification results.

- [x] **Step 4: Commit docs and plan record**

```bash
git add README.md CHANGELOG.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/ROADMAP.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md docs/superpowers/plans/2026-07-06-governed-fixture-to-replay-sandbox-contract-bridge.md
git diff --check --cached
git commit -m "docs: complete fixture replay sandbox contract bridge"
```

---

## Self-Review Checklist

- Spec coverage: safe fixture mapping, committed catalog compatibility, provenance rejection, redaction-boundary rejection, contract validation, sandbox prototype compatibility, docs, and verification are covered.
- Scope boundary: no LLM replay, no tool execution, no route calls, no runtime store reads/writes, no business asset writes, no fixture JSON changes, no Runtime Console changes.
- Placeholder scan: this plan contains no deferred placeholders.

## Completion Notes

- Completed on: 2026-07-06
- Commits:
  - `8183ae7` - `docs: spec fixture replay sandbox contract bridge`
  - `4e6da0e` - `docs: plan fixture replay sandbox contract bridge`
  - `14973ec` - `test: specify fixture replay sandbox contract bridge`
  - `5234300` - `feat: bridge governed fixtures to replay sandbox contracts`
  - `50ccc30` - `test: include fixture contract bridge in controlled runtime`
- TDD evidence:
  - RED: `npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts` failed because `@/lib/executor/runtime/replay-sandbox-fixture-contract` did not exist.
  - GREEN: `npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts src/__tests__/lib/executor/runtime/replay-sandbox.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts` passed with 3 files / 10 tests.
- Final verification:
  - `git diff --check` - exit 0
  - `npm run trace:fixtures --silent` - ok true; 2 total / 2 passed / 0 failed
  - `npm run trace:fixtures:summary --silent` - Status OK
  - `npm run test:controlled-runtime` - 33 files / 176 tests passed
  - `npm run test:core-workflows` - all core workflow regressions passed
- Outcome: Phase 10z is complete. Phase 10aa Catalog-Level Replay Sandbox Report has since completed; the current recommended phase is Replay Sandbox Catalog CI Summary.
