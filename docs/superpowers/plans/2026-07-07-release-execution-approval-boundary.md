# Release Execution Approval Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only release execution approval boundary after the production verification gate.

**Architecture:** Follow the current release gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one release execution approval JSON file, reuses the production verification gate checker, and passes parsed reports into the validator. The checker validates final approval requirements, execution readiness review, action authorization, command evidence, credential boundaries, and approval-boundary-only behavior without approving or executing any release action.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution gate conventions.

---

### Task 1: Release Execution Approval Boundary Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/release-execution-approval-boundary.ts`
- Create: `scripts/release-execution/check-release-execution-approval.mjs`
- Test: `src/__tests__/lib/executor/playbooks/release-execution-approval-boundary.test.ts`
- Test: `src/__tests__/scripts/release-execution-approval-check-script.test.ts`

- [x] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/release-execution-approval-boundary.test.ts`

Expected: fail because `src/lib/executor/playbooks/release-execution-approval-boundary.ts` does not exist.

- [x] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/release-execution-approval-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-release-execution-approval.mjs` does not exist.

- [x] **Step 3: Implement validator and CLI**

The validator must fail closed unless production verification gate evidence is green, command evidence is ordered and green, identity fields are valid, execution readiness review is complete, operator approval requirements are complete, release action authorizations remain blocked, credentials remain disallowed, and the boundary remains approval-boundary-only.

- [x] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/release-execution-approval-boundary.test.ts src/__tests__/scripts/release-execution-approval-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-approvals/example-release-execution-approval-boundary.json`
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

Add `release:execution-approval:check` and include both new tests in `test:controlled-runtime`.

- [x] **Step 2: Add tracked example release execution approval boundary**

The example must reference the tracked production verification gate, summarize green production-verification/hygiene/runtime/core/lint/build/diff evidence, include owner identity, target version, expiry, execution readiness review, operator approval requirements, release action authorization, credential boundary, and approval-boundary-only metadata.

- [x] **Step 3: Update documentation**

Update project docs to say release execution approval boundary review is now declared. Continue to state that real release execution, production verification execution, connector calls, external writes, store writes, credential use, and production readiness claims remain blocked until explicit human/operator action and separate post-execution evidence exist.

- [x] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/release-execution-approval-boundary.test.ts src/__tests__/scripts/release-execution-approval-check-script.test.ts
npm run release:execution-approval:check -- --approval docs/release-execution-approvals/example-release-execution-approval-boundary.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers production verification gate reuse, identity fields, expiry, execution readiness review, operator approval requirements, release action authorization, command evidence, credential boundary, approval-boundary-only behavior, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `release execution approval boundary`, `productionVerificationGatePath`, `executionReadinessReview`, `operatorApprovalRequirements`, `releaseActionAuthorization`, `approvalBoundary`, `approvalBoundaryOnly`, and `release_execution_approval_boundary_review` consistently.
