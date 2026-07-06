# Replay Sandbox Contract Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TypeScript-only replay sandbox contracts and pure validation so future real replay work has executable boundary checks before any replay prototype exists.

**Architecture:** Add a focused runtime contract module beside existing trace governance/replay helpers. Tests drive a pure validator that accepts no-side-effect contracts and rejects raw controlled runs, live credentials, live approval, production store access, and business asset side effects.

**Tech Stack:** TypeScript, Vitest, existing `test:controlled-runtime`, existing governed trace fixture/replay modules.

---

## File Structure

- Create `src/lib/executor/runtime/replay-sandbox-contracts.ts`
  - Exports contract types and pure validation helpers.
- Create `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`
  - Proves safe contracts validate and unsafe boundaries are rejected.
- Modify `package.json`
  - Add the new test file to `test:controlled-runtime`.
- Modify `docs/NEXT_STEPS.md`
  - Record Phase 10w completion and set next recommended work to No-Side-Effect Replay Sandbox Prototype Design.
- Modify `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Add Phase 10w to the progress snapshot.
- Modify `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
  - Note that contract types now encode the documented boundary, while real replay remains unimplemented.
- Modify `CHANGELOG.md`
  - Record the new contract types and validation.

---

### Task 1: TDD The Replay Sandbox Contract Validator

**Files:**
- Create: `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`
- Create: `src/lib/executor/runtime/replay-sandbox-contracts.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildNoSideEffectReplayResultArtifact,
  type ReplaySandboxContract,
  validateReplaySandboxContract,
} from "@/lib/executor/runtime/replay-sandbox-contracts";

function makeSafeContract(
  overrides: Partial<ReplaySandboxContract> = {},
): ReplaySandboxContract {
  return {
    replayId: "replay-1",
    sandboxId: "sandbox-1",
    mode: "contract_validation",
    input: {
      kind: "committed_fixture",
      sourceId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      scenarioId: "sales-pipeline",
      generatedAt: 100,
      governanceMode: "fixture",
      redactionBoundary: "required",
    },
    credentialPolicy: {
      mode: "none",
    },
    approvalPolicy: {
      mode: "fixture_derived",
    },
    storePolicy: {
      mode: "fixture_only",
      requestedStores: [],
    },
    sideEffectPolicy: {
      allowedOutput: "replay_result_artifact",
      blocked: [],
    },
    ...overrides,
  };
}

describe("replay sandbox contracts", () => {
  it("accepts a no-side-effect replay sandbox contract", () => {
    const result = validateReplaySandboxContract(makeSafeContract());

    expect(result).toEqual({
      ok: true,
      errors: [],
      warnings: [],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
  });

  it("rejects raw controlled run input", () => {
    const result = validateReplaySandboxContract(
      makeSafeContract({
        input: {
          ...makeSafeContract().input,
          kind: "raw_controlled_run",
        },
      }),
    );

    expect(result.errors).toContain("Replay input raw_controlled_run is not allowed");
  });

  it("rejects live credentials, live approvals, production stores, and business asset writes", () => {
    const result = validateReplaySandboxContract(
      makeSafeContract({
        credentialPolicy: { mode: "live_api_key" },
        approvalPolicy: { mode: "live_operator" },
        storePolicy: {
          mode: "sandbox_snapshot",
          requestedStores: ["sales_asset_store"],
        },
        sideEffectPolicy: {
          allowedOutput: "replay_result_artifact",
          blocked: ["business_asset_write"],
        },
      }),
    );

    expect(result.errors).toEqual([
      "Live replay credential live_api_key is not allowed",
      "Replay approval mode live_operator is not allowed",
      "Replay store access sales_asset_store is not allowed",
      "Replay side effect business_asset_write is not allowed",
    ]);
    expect(result.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
      runtimeStoresMutated: false,
      productionCredentialsUsed: false,
    });
  });

  it("builds a replay result artifact that cannot be confused with business output", () => {
    const contract = makeSafeContract();
    const artifact = buildNoSideEffectReplayResultArtifact(contract, {
      generatedAt: 200,
      diagnostics: ["contract accepted"],
    });

    expect(artifact).toEqual({
      schemaVersion: "replay-result-artifact/v1",
      replayId: "replay-1",
      sandboxId: "sandbox-1",
      mode: "contract_validation",
      source: contract.input,
      simulatedApprovals: [],
      blockedSideEffects: [],
      diagnostics: ["contract accepted"],
      generatedAt: 200,
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts
```

Expected: FAIL because `@/lib/executor/runtime/replay-sandbox-contracts` does not exist.

- [ ] **Step 3: Implement the minimal contract module**

Create `src/lib/executor/runtime/replay-sandbox-contracts.ts`:

```ts
export type ReplayInputKind =
  | "governed_artifact"
  | "committed_fixture"
  | "sandbox_snapshot"
  | "raw_controlled_run";

export type ReplayCredentialMode =
  | "none"
  | "fake"
  | "fixture"
  | "replay_scoped"
  | "live_api_key"
  | "bearer_token"
  | "connector_credential"
  | "user_session"
  | "production_account"
  | "ambient";

export type ReplayApprovalMode =
  | "fixture_derived"
  | "simulated"
  | "require_record_only"
  | "live_operator"
  | "production_approval_store";

export type ReplayStoreMode = "none" | "sandbox_snapshot" | "fixture_only";

export type ReplayStoreAccess =
  | "controlled_run_store"
  | "approval_store"
  | "workflow_run_store"
  | "draft_store"
  | "sales_asset_store"
  | "support_asset_store"
  | "knowledge_asset_store";

export type ReplaySideEffect =
  | "llm_call"
  | "tool_execution"
  | "api_route_call"
  | "connector_call"
  | "webhook"
  | "email"
  | "notification"
  | "runtime_store_write"
  | "business_asset_write"
  | "file_write_outside_replay_artifact";

export type ReplaySandboxContract = {
  replayId: string;
  sandboxId: string;
  mode: "contract_validation" | "no_side_effect_prototype";
  input: {
    kind: ReplayInputKind;
    sourceId: string;
    playbookId: string;
    playbookVersion: string;
    scenarioId: string;
    generatedAt: number;
    governanceMode: "fixture" | "audit";
    redactionBoundary: "required";
  };
  credentialPolicy: {
    mode: ReplayCredentialMode;
  };
  approvalPolicy: {
    mode: ReplayApprovalMode;
    simulatedDecisions?: Array<{
      stepId: string;
      decision: "approved" | "rejected" | "not_required";
    }>;
  };
  storePolicy: {
    mode: ReplayStoreMode;
    requestedStores: ReplayStoreAccess[];
  };
  sideEffectPolicy: {
    allowedOutput: "replay_result_artifact";
    blocked: ReplaySideEffect[];
  };
};

export type ReplaySandboxGuarantees = {
  toolCallsExecuted: false;
  assetsWritten: false;
  runtimeStoresMutated: false;
  productionCredentialsUsed: false;
};

export type ReplaySandboxContractValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  guarantees: ReplaySandboxGuarantees;
};

export type ReplayResultArtifact = {
  schemaVersion: "replay-result-artifact/v1";
  replayId: string;
  sandboxId: string;
  mode: ReplaySandboxContract["mode"];
  source: ReplaySandboxContract["input"];
  simulatedApprovals: NonNullable<
    ReplaySandboxContract["approvalPolicy"]["simulatedDecisions"]
  >;
  blockedSideEffects: ReplaySideEffect[];
  diagnostics: string[];
  generatedAt: number;
  guarantees: ReplaySandboxGuarantees;
};

const replaySandboxGuarantees: ReplaySandboxGuarantees = {
  toolCallsExecuted: false,
  assetsWritten: false,
  runtimeStoresMutated: false,
  productionCredentialsUsed: false,
};

const forbiddenCredentialModes: ReplayCredentialMode[] = [
  "live_api_key",
  "bearer_token",
  "connector_credential",
  "user_session",
  "production_account",
  "ambient",
];

const forbiddenApprovalModes: ReplayApprovalMode[] = [
  "live_operator",
  "production_approval_store",
];

const forbiddenStores: ReplayStoreAccess[] = [
  "controlled_run_store",
  "approval_store",
  "workflow_run_store",
  "draft_store",
  "sales_asset_store",
  "support_asset_store",
  "knowledge_asset_store",
];

const forbiddenSideEffects: ReplaySideEffect[] = [
  "llm_call",
  "tool_execution",
  "api_route_call",
  "connector_call",
  "webhook",
  "email",
  "notification",
  "runtime_store_write",
  "business_asset_write",
  "file_write_outside_replay_artifact",
];

export function validateReplaySandboxContract(
  contract: ReplaySandboxContract,
): ReplaySandboxContractValidationResult {
  const errors: string[] = [];

  if (!contract.input.sourceId) errors.push("Replay input sourceId is required");
  if (!contract.input.playbookId) errors.push("Replay input playbookId is required");
  if (!contract.input.playbookVersion) {
    errors.push("Replay input playbookVersion is required");
  }
  if (contract.input.kind === "raw_controlled_run") {
    errors.push("Replay input raw_controlled_run is not allowed");
  }
  if (contract.input.redactionBoundary !== "required") {
    errors.push("Replay input redaction boundary is required");
  }
  if (forbiddenCredentialModes.includes(contract.credentialPolicy.mode)) {
    errors.push(`Live replay credential ${contract.credentialPolicy.mode} is not allowed`);
  }
  if (forbiddenApprovalModes.includes(contract.approvalPolicy.mode)) {
    errors.push(`Replay approval mode ${contract.approvalPolicy.mode} is not allowed`);
  }
  for (const store of contract.storePolicy.requestedStores) {
    if (forbiddenStores.includes(store)) {
      errors.push(`Replay store access ${store} is not allowed`);
    }
  }
  for (const sideEffect of contract.sideEffectPolicy.blocked) {
    if (forbiddenSideEffects.includes(sideEffect)) {
      errors.push(`Replay side effect ${sideEffect} is not allowed`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: [],
    guarantees: replaySandboxGuarantees,
  };
}

export function buildNoSideEffectReplayResultArtifact(
  contract: ReplaySandboxContract,
  options: {
    generatedAt?: number;
    diagnostics?: string[];
  } = {},
): ReplayResultArtifact {
  return {
    schemaVersion: "replay-result-artifact/v1",
    replayId: contract.replayId,
    sandboxId: contract.sandboxId,
    mode: contract.mode,
    source: contract.input,
    simulatedApprovals: contract.approvalPolicy.simulatedDecisions ?? [],
    blockedSideEffects: contract.sideEffectPolicy.blocked,
    diagnostics: options.diagnostics ?? [],
    generatedAt: options.generatedAt ?? Date.now(),
    guarantees: replaySandboxGuarantees,
  };
}
```

- [ ] **Step 4: Run the test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts src/lib/executor/runtime/replay-sandbox-contracts.ts
git diff --check --cached
git commit -m "feat: add replay sandbox contracts"
```

---

### Task 2: Add Controlled Runtime Gate Coverage

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the test to `test:controlled-runtime`**

In `package.json`, insert this path after `src/__tests__/lib/executor/runtime/trace-replay.test.ts`:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts
```

- [ ] **Step 2: Run controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS and includes the new replay sandbox contract test file.

- [ ] **Step 3: Commit Task 2**

```bash
git add package.json
git diff --check --cached
git commit -m "test: include replay sandbox contracts"
```

---

### Task 3: Align Docs And Records

**Files:**
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update `docs/NEXT_STEPS.md`**

Add a completed section:

```markdown
## Completed. Replay Sandbox Contract Types

Why:

- Phase 10v documented the real replay boundary, but the runtime layer needed executable TypeScript contracts before any prototype work.
- Future replay work needed a pure validator that rejects live credentials, production store access, business asset writes, and raw controlled run inputs.

Delivered:

- Added `src/lib/executor/runtime/replay-sandbox-contracts.ts`.
- Added `validateReplaySandboxContract()` with stable no-side-effect guarantees.
- Added replay result artifact shape helper for no-side-effect replay outputs.
- Added contract tests covering safe contracts, raw controlled run rejection, live credential rejection, live approval rejection, production store rejection, and business asset write rejection.
- Included the new test in `npm run test:controlled-runtime`.

Outcome:

- Future work can design a no-side-effect replay sandbox prototype against explicit contracts without touching production stores or business assets.

## Recommended Next. No-Side-Effect Replay Sandbox Prototype Design

Suggested scope:

- Design the smallest prototype that consumes a validated replay sandbox contract and emits only a replay result artifact.
- Keep the prototype no-side-effect: no LLM replay, no tool execution, no route calls, no runtime store reads/writes, and no asset writes.
- Add tests proving unsafe contracts fail before prototype execution starts.
```

- [ ] **Step 2: Update controlled runtime manual and boundary guide**

Record Phase 10w in the runtime manual progress list. In the real replay boundary guide, note that contract types now encode the boundary while real replay remains unimplemented.

- [ ] **Step 3: Update changelog**

Add:

```markdown
### Replay Sandbox Contract Types

- Added TypeScript-only replay sandbox contract types and validation for replay input provenance, credentials, approval simulation, store isolation, side-effect policy, and replay result artifacts.
- Added no-side-effect contract tests and included them in `test:controlled-runtime`.
```

- [ ] **Step 4: Commit Task 3**

```bash
git add docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md CHANGELOG.md
git diff --check --cached
git commit -m "docs: complete replay sandbox contracts"
```

---

### Task 4: Final Verification And Plan Record

**Files:**
- Modify: `docs/superpowers/plans/2026-07-06-replay-sandbox-contract-types.md`
- Optional local-only: `memory/2026-07-06.md`

- [ ] **Step 1: Run final verification**

Run:

```bash
git diff --check
npm run test:controlled-runtime
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:core-workflows
```

Expected:

- whitespace check exits 0;
- controlled runtime tests pass;
- fixture replay JSON reports `ok: true`;
- fixture summary reports `Status: OK`;
- core workflow regressions pass.

- [ ] **Step 2: Mark this plan complete**

Update checkboxes to `- [x]` and add completion notes with exact verification results.

- [ ] **Step 3: Commit final plan record**

```bash
git add docs/superpowers/plans/2026-07-06-replay-sandbox-contract-types.md
git diff --check --cached
git commit -m "docs: complete replay sandbox contract plan"
```

---

## Self-Review Checklist

- Spec coverage: replay input, sandbox context, credentials, approvals, store isolation, side-effect policy, result artifact, validation, docs, and verification are covered.
- TDD coverage: test-first RED/GREEN sequence is explicit.
- Scope boundary: no real replay, tool execution, route calls, store access, asset writes, fixture JSON, package script additions, or UI changes.
- Placeholder scan: this plan contains no deferred placeholders.
