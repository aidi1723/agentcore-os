# Release Execution Planning Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only release execution planning gate after the production release approval packet.

**Architecture:** Follow the current gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one execution plan JSON file, reuses the production release approval checker, and passes parsed reports into the validator. The checker validates release action planning metadata, command evidence, rollback/monitoring/credential boundaries, and planning-only release boundaries without publishing, tagging, packaging, uploading, deploying, using credentials, or claiming production readiness.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing production release approval checker conventions.

---

### Task 1: Execution Plan Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/release-execution-plan.ts`
- Create: `scripts/release-execution/check-release-execution-plan.mjs`
- Test: `src/__tests__/lib/executor/playbooks/release-execution-plan.test.ts`
- Test: `src/__tests__/scripts/release-execution-plan-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/release-execution-plan.test.ts`

Expected: fail because `src/lib/executor/playbooks/release-execution-plan.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/release-execution-plan-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-release-execution-plan.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless production approval evidence is green, command evidence is ordered and green, identity fields are valid, planned actions are documented and not executed, credentials remain disallowed, rollback/monitoring sections exist, and the execution boundary remains planning-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/release-execution-plan.test.ts src/__tests__/scripts/release-execution-plan-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-plans/example-release-execution-plan.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Add npm script and controlled-runtime coverage**

Add `release:execution-plan:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example execution plan**

The example must reference the tracked production release approval packet, summarize green approval/policy/runtime/core/lint/build/diff evidence, include owner identity, target version, planned release action metadata, preconditions, rollback plan, monitoring plan, credential boundary, and planning-only execution boundary.

- [ ] **Step 3: Update documentation**

Update project docs to say release execution planning is now declared, and the next concrete gap is individual execution gate design for package build, tag creation, artifact upload, deployment, and external writes. Continue to state that publishing, tag creation, package build, upload, deployment, external writes, credential use, and production readiness claims remain blocked.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/release-execution-plan.test.ts src/__tests__/scripts/release-execution-plan-check-script.test.ts
npm run release:execution-plan:check -- --plan docs/release-execution-plans/example-release-execution-plan.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers approval reuse, identity fields, target version, action planning metadata, command evidence, rollback/monitoring ownership, credential boundary, planning-only release boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `release execution plan`, `approvalPath`, `plannedActions`, `credentialBoundary`, `executionBoundary`, `planningOnly`, and `release_execution_planning` consistently.
