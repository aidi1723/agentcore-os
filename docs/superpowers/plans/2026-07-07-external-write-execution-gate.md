# External-Write Execution Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only external-write execution gate after the deployment execution gate.

**Architecture:** Follow the current release gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one external-write gate JSON file, reuses the deployment gate checker, and passes parsed reports into the validator. The checker validates external write request metadata, external system review, idempotency policy, command evidence, rollback/monitoring plans, credential boundaries, and gate-only external write boundaries without connector calls, external writes, store writes, credentials, or production-readiness claims.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution gate conventions.

---

### Task 1: External-Write Gate Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/external-write-execution-gate.ts`
- Create: `scripts/release-execution/check-external-write-gate.mjs`
- Test: `src/__tests__/lib/executor/playbooks/external-write-execution-gate.test.ts`
- Test: `src/__tests__/scripts/external-write-gate-check-script.test.ts`

- [x] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/external-write-execution-gate.test.ts`

Expected: fail because `src/lib/executor/playbooks/external-write-execution-gate.ts` does not exist.

- [x] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/external-write-gate-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-external-write-gate.mjs` does not exist.

- [x] **Step 3: Implement validator and CLI**

The validator must fail closed unless deployment gate evidence is green, command evidence is ordered and green, identity fields are valid, external write request/system/idempotency metadata is documented, rollback and monitoring sections exist, credentials remain disallowed, external write decision remains blocked, and the boundary remains gate-only.

- [x] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/external-write-execution-gate.test.ts src/__tests__/scripts/external-write-gate-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-gates/example-external-write-gate.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] **Step 1: Add npm script and controlled-runtime coverage**

Add `release:external-write:gate:check` and include both new tests in `test:controlled-runtime`.

- [x] **Step 2: Add tracked example external-write gate**

The example must reference the tracked deployment gate, summarize green deployment-gate/hygiene/runtime/core/lint/build/diff evidence, include owner identity, target version, external write request metadata, external system review, idempotency policy, rollback plan, monitoring plan, credential boundary, external write decision, and gate-only external write boundary.

- [x] **Step 3: Update documentation**

Update project docs to say external-write execution gate review is now declared, and the next concrete gap is production verification / release execution approval boundary design. Continue to state that real external writes, connector calls, store writes, credential use, deployment verification, and production readiness claims remain blocked.

- [x] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/external-write-execution-gate.test.ts src/__tests__/scripts/external-write-gate-check-script.test.ts
npm run release:external-write:gate:check -- --gate docs/release-execution-gates/example-external-write-gate.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers deployment gate reuse, identity fields, external write request, external system review, idempotency policy, command evidence, rollback/monitoring, credential boundary, gate-only external write boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `external-write execution gate`, `deploymentGatePath`, `externalWriteRequest`, `externalSystemReview`, `idempotencyPolicy`, `externalWriteDecision`, `externalWriteBoundary`, `gateOnly`, and `external_write_execution_gate_review` consistently.
