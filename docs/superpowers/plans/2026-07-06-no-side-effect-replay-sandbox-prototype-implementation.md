# No-Side-Effect Replay Sandbox Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the smallest no-side-effect replay sandbox prototype that consumes a `ReplaySandboxContract` and returns only a replay result artifact.

**Architecture:** Keep the prototype as a pure runtime helper in `src/lib/executor/runtime/replay-sandbox.ts`. It validates the contract first, returns a failure artifact for unsafe contracts, and returns a replay-local success artifact for safe contracts without calling executors, routes, stores, tools, fixtures, or UI code.

**Tech Stack:** TypeScript, Vitest, existing replay sandbox contracts, existing `test:controlled-runtime`, existing governed fixture replay commands.

---

## File Structure

- Create `src/__tests__/lib/executor/runtime/replay-sandbox.test.ts`
  - TDD coverage for unsafe preflight failure, safe replay-local artifact emission, and artifact shape isolation.
- Create `src/lib/executor/runtime/replay-sandbox.ts`
  - Pure `runNoSideEffectReplaySandbox(contract: ReplaySandboxContract): ReplayResultArtifact` implementation.
- Modify `src/lib/executor/runtime/replay-sandbox-contracts.ts`
  - Add replay result artifact `status` and `cursorEvents` fields.
  - Add cursor event and status types.
  - Extend `buildNoSideEffectReplayResultArtifact()` options.
- Modify `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`
  - Align the existing artifact builder assertion with the expanded artifact shape.
- Modify `package.json`
  - Include `src/__tests__/lib/executor/runtime/replay-sandbox.test.ts` in `test:controlled-runtime`.
- Modify docs after implementation:
  - `README.md`
  - `CHANGELOG.md`
  - `docs/NEXT_STEPS.md`
  - `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - `docs/ROADMAP.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`

---

### Task 1: Add Failing Prototype Tests

**Files:**
- Create: `src/__tests__/lib/executor/runtime/replay-sandbox.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/executor/runtime/replay-sandbox.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runNoSideEffectReplaySandbox } from "@/lib/executor/runtime/replay-sandbox";
import type { ReplaySandboxContract } from "@/lib/executor/runtime/replay-sandbox-contracts";

function makeContract(
  overrides: Partial<ReplaySandboxContract> = {},
): ReplaySandboxContract {
  return {
    replayId: "replay-prototype-1",
    sandboxId: "sandbox-prototype-1",
    mode: "no_side_effect_prototype",
    input: {
      kind: "committed_fixture",
      sourceId: "controlled-trace-fixture:sales-pipeline-governed",
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
      mode: "simulated",
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
    ...overrides,
  };
}

describe("no-side-effect replay sandbox", () => {
  it("returns a failure artifact when preflight validation rejects the contract", () => {
    const artifact = runNoSideEffectReplaySandbox(
      makeContract({
        input: {
          ...makeContract().input,
          kind: "raw_controlled_run",
        },
        credentialPolicy: {
          mode: "live_api_key",
        },
      }),
    );

    expect(artifact.status).toBe("failed");
    expect(artifact.cursorEvents).toEqual(["preflight"]);
    expect(artifact.diagnostics).toEqual([
      "Replay input raw_controlled_run is not allowed",
      "Live replay credential live_api_key is not allowed",
    ]);
    expect(artifact.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
      runtimeStoresMutated: false,
      productionCredentialsUsed: false,
    });
  });

  it("emits a replay-local result artifact for a safe contract", () => {
    const artifact = runNoSideEffectReplaySandbox(makeContract());

    expect(artifact).toMatchObject({
      schemaVersion: "replay-result-artifact/v1",
      replayId: "replay-prototype-1",
      sandboxId: "sandbox-prototype-1",
      mode: "no_side_effect_prototype",
      status: "succeeded",
      source: makeContract().input,
      simulatedApprovals: [
        {
          stepId: "human_review",
          decision: "approved",
        },
      ],
      blockedSideEffects: [],
      diagnostics: ["Replay sandbox preflight accepted"],
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
    });
    expect(artifact.generatedAt).toEqual(expect.any(Number));
  });

  it("does not shape the artifact like a controlled run or business asset", () => {
    const artifact = runNoSideEffectReplaySandbox(makeContract());

    expect(artifact).not.toHaveProperty("steps");
    expect(artifact).not.toHaveProperty("state");
    expect(artifact).not.toHaveProperty("writebackReceipts");
    expect(artifact).not.toHaveProperty("assetId");
    expect(artifact).not.toHaveProperty("workflowRunId");
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox.test.ts
```

Expected: FAIL because `@/lib/executor/runtime/replay-sandbox` does not exist.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/__tests__/lib/executor/runtime/replay-sandbox.test.ts
git diff --check --cached
git commit -m "test: specify no-side-effect replay sandbox prototype"
```

---

### Task 2: Implement The Pure Replay Sandbox

**Files:**
- Create: `src/lib/executor/runtime/replay-sandbox.ts`
- Modify: `src/lib/executor/runtime/replay-sandbox-contracts.ts`
- Modify: `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`

- [ ] **Step 1: Add artifact status and cursor event types**

In `src/lib/executor/runtime/replay-sandbox-contracts.ts`, add:

```ts
export type ReplaySandboxCursorEvent =
  | "preflight"
  | "load_source_metadata"
  | "simulate_approvals"
  | "block_side_effects"
  | "emit_result_artifact";

export type ReplayResultArtifactStatus = "succeeded" | "failed";
```

Extend `ReplayResultArtifact` with:

```ts
  status: ReplayResultArtifactStatus;
  cursorEvents: ReplaySandboxCursorEvent[];
```

Extend `buildNoSideEffectReplayResultArtifact()` options with:

```ts
    status?: ReplayResultArtifactStatus;
    cursorEvents?: ReplaySandboxCursorEvent[];
```

Return defaults:

```ts
    status: options.status ?? "succeeded",
    cursorEvents: options.cursorEvents ?? [],
```

- [ ] **Step 2: Add the prototype implementation**

Create `src/lib/executor/runtime/replay-sandbox.ts`:

```ts
import {
  buildNoSideEffectReplayResultArtifact,
  type ReplayResultArtifact,
  type ReplaySandboxContract,
  type ReplaySandboxCursorEvent,
  validateReplaySandboxContract,
} from "./replay-sandbox-contracts";

const successfulReplayCursorEvents: ReplaySandboxCursorEvent[] = [
  "preflight",
  "load_source_metadata",
  "simulate_approvals",
  "block_side_effects",
  "emit_result_artifact",
];

export function runNoSideEffectReplaySandbox(
  contract: ReplaySandboxContract,
): ReplayResultArtifact {
  const validation = validateReplaySandboxContract(contract);

  if (!validation.ok) {
    return buildNoSideEffectReplayResultArtifact(contract, {
      status: "failed",
      cursorEvents: ["preflight"],
      diagnostics: validation.errors,
    });
  }

  return buildNoSideEffectReplayResultArtifact(contract, {
    status: "succeeded",
    cursorEvents: successfulReplayCursorEvents,
    diagnostics: ["Replay sandbox preflight accepted"],
  });
}
```

- [ ] **Step 3: Align contract artifact builder test**

In `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`, update the artifact expectation to include:

```ts
      status: "succeeded",
      cursorEvents: [],
```

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts
```

Expected: PASS, 2 files.

- [ ] **Step 5: Commit implementation**

```bash
git add src/lib/executor/runtime/replay-sandbox.ts src/lib/executor/runtime/replay-sandbox-contracts.ts src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts
git diff --check --cached
git commit -m "feat: add no-side-effect replay sandbox prototype"
```

---

### Task 3: Include Prototype In Controlled Runtime Gate

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the prototype test to `test:controlled-runtime`**

In `package.json`, add this path immediately after `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`:

```text
src/__tests__/lib/executor/runtime/replay-sandbox.test.ts
```

- [ ] **Step 2: Run the controlled runtime gate**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the new replay sandbox prototype test included.

- [ ] **Step 3: Commit the gate update**

```bash
git add package.json
git diff --check --cached
git commit -m "test: include replay sandbox prototype in controlled runtime"
```

---

### Task 4: Align Documentation And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-no-side-effect-replay-sandbox-prototype-implementation.md`

- [ ] **Step 1: Update current docs**

Record Phase 10y as completed and set the next recommended phase to replay sandbox contract factory / fixture-to-contract bridge.

The docs must state:

- `src/lib/executor/runtime/replay-sandbox.ts` now exists.
- `runNoSideEffectReplaySandbox()` validates first.
- Unsafe contracts return failure artifacts with only `preflight` cursor advancement.
- Safe contracts emit replay-local result artifacts with no executor, route, store, tool, UI, or asset side effects.
- The next phase should convert governed fixtures into replay sandbox contracts without recovering raw payloads or touching stores.

- [ ] **Step 2: Run final verification**

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

- [ ] **Step 3: Mark this plan complete**

Update all checkboxes to `- [x]` and add completion notes with exact verification results.

- [ ] **Step 4: Commit docs and plan record**

```bash
git add README.md CHANGELOG.md docs/NEXT_STEPS.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/ROADMAP.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md docs/superpowers/plans/2026-07-06-no-side-effect-replay-sandbox-prototype-implementation.md
git diff --check --cached
git commit -m "docs: complete no-side-effect replay sandbox prototype"
```

---

## Self-Review Checklist

- Spec coverage: consumes only `ReplaySandboxContract`, validates first, returns failure artifact for unsafe input, returns safe replay-local artifact for valid input, preserves no-side-effect guarantees, and avoids executor/route/store/UI integration.
- Scope boundary: no LLM replay, no tool execution, no route calls, no runtime store reads/writes, no business asset writes, no fixture JSON changes, no Runtime Console changes.
- Placeholder scan: this plan contains no deferred placeholders.
