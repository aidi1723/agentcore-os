# Production Verification Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only production verification gate after the external-write execution gate.

**Architecture:** Follow the current release gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one production verification gate JSON file, reuses the external-write gate checker, and passes parsed reports into the validator. The checker validates production verification plan metadata, post-action checks, monitoring readiness, incident/rollback readiness, command evidence, credential boundaries, and verification-only boundaries without executing verification, release actions, connector calls, external writes, store writes, credentials, or production-readiness claims.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution gate conventions.

---

### Task 1: Production Verification Gate Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/production-verification-gate.ts`
- Create: `scripts/release-execution/check-production-verification-gate.mjs`
- Test: `src/__tests__/lib/executor/playbooks/production-verification-gate.test.ts`
- Test: `src/__tests__/scripts/production-verification-gate-check-script.test.ts`

- [x] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/production-verification-gate.test.ts`

Expected: fail because `src/lib/executor/playbooks/production-verification-gate.ts` does not exist.

- [x] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/production-verification-gate-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-production-verification-gate.mjs` does not exist.

- [x] **Step 3: Implement validator and CLI**

The validator must fail closed unless external-write gate evidence is green, command evidence is ordered and green, identity fields are valid, production verification plan/check/monitoring/incident metadata is documented, credentials remain disallowed, verification decision remains blocked, and the boundary remains verification-only.

- [x] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/production-verification-gate.test.ts src/__tests__/scripts/production-verification-gate-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-gates/example-production-verification-gate.json`
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

Add `release:production-verification:gate:check` and include both new tests in `test:controlled-runtime`.

- [x] **Step 2: Add tracked example production verification gate**

The example must reference the tracked external-write gate, summarize green external-write-gate/hygiene/runtime/core/lint/build/diff evidence, include owner identity, target version, verification plan, post-action checks, monitoring readiness, incident/rollback readiness, credential boundary, verification decision, and verification-only boundary.

- [x] **Step 3: Update documentation**

Update project docs to say production verification gate review is now declared, and the next concrete gap is release execution approval boundary design. Continue to state that production verification execution, release actions, connector calls, external writes, credential use, and production readiness claims remain blocked.

- [x] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/production-verification-gate.test.ts src/__tests__/scripts/production-verification-gate-check-script.test.ts
npm run release:production-verification:gate:check -- --gate docs/release-execution-gates/example-production-verification-gate.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers external-write gate reuse, identity fields, verification plan, post-action checks, monitoring readiness, incident/rollback readiness, command evidence, credential boundary, verification-only boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `production verification gate`, `externalWriteGatePath`, `verificationPlan`, `postActionChecks`, `monitoringReadiness`, `incidentRollbackReadiness`, `verificationDecision`, `verificationBoundary`, `verificationOnly`, and `production_verification_gate_review` consistently.
