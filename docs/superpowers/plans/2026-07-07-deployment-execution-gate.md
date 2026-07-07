# Deployment Execution Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only deployment execution gate after the artifact upload execution gate.

**Architecture:** Follow the current release gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one deployment gate JSON file, reuses the artifact upload gate checker, and passes parsed reports into the validator. The checker validates deployment request metadata, environment review, pre-deployment checks, command evidence, rollback/monitoring plans, credential boundaries, and gate-only deployment boundaries without deploying, external writes, credentials, or production-readiness claims.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution gate conventions.

---

### Task 1: Deployment Gate Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/deployment-execution-gate.ts`
- Create: `scripts/release-execution/check-deployment-gate.mjs`
- Test: `src/__tests__/lib/executor/playbooks/deployment-execution-gate.test.ts`
- Test: `src/__tests__/scripts/deployment-gate-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/deployment-execution-gate.test.ts`

Expected: fail because `src/lib/executor/playbooks/deployment-execution-gate.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/deployment-gate-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-deployment-gate.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless artifact upload gate evidence is green, command evidence is ordered and green, identity fields are valid, deployment request/environment/pre-deployment metadata is documented, rollback and monitoring sections exist, credentials remain disallowed, deployment decision remains blocked, and the boundary remains gate-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/deployment-execution-gate.test.ts src/__tests__/scripts/deployment-gate-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-gates/example-deployment-gate.json`
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

Add `release:deployment:gate:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example deployment gate**

The example must reference the tracked artifact upload gate, summarize green artifact-gate/hygiene/runtime/core/lint/build/diff evidence, include owner identity, target version, deployment request metadata, environment review, pre-deployment checks, rollback plan, monitoring plan, credential boundary, deployment decision, and gate-only deployment boundary.

- [ ] **Step 3: Update documentation**

Update project docs to say deployment execution gate review is now declared, and the next concrete gap is external-write execution gate design. Continue to state that real deployment, external writes, credential use, and production readiness claims remain blocked.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/deployment-execution-gate.test.ts src/__tests__/scripts/deployment-gate-check-script.test.ts
npm run release:deployment:gate:check -- --gate docs/release-execution-gates/example-deployment-gate.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers artifact upload gate reuse, identity fields, deployment request, environment review, pre-deployment checks, command evidence, rollback/monitoring, credential boundary, gate-only deployment boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `deployment execution gate`, `artifactUploadGatePath`, `deploymentRequest`, `deploymentEnvironmentReview`, `preDeploymentChecks`, `deploymentDecision`, `deploymentBoundary`, `gateOnly`, and `deployment_execution_gate_review` consistently.
