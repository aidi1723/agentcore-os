# Package Build Execution Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only package build execution gate after the release execution planning gate.

**Architecture:** Follow the current gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one package build gate JSON file, reuses the release execution plan checker, and passes parsed reports into the validator. The checker validates package build request metadata, source/supply-chain review, command evidence, rollback/monitoring/artifact handling, credential boundaries, and gate-only release boundaries without running package commands, generating artifacts, uploading, tagging, deploying, using credentials, or claiming production readiness.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution plan checker conventions.

---

### Task 1: Package Build Gate Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/package-build-execution-gate.ts`
- Create: `scripts/release-execution/check-package-build-gate.mjs`
- Test: `src/__tests__/lib/executor/playbooks/package-build-execution-gate.test.ts`
- Test: `src/__tests__/scripts/package-build-gate-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/package-build-execution-gate.test.ts`

Expected: fail because `src/lib/executor/playbooks/package-build-execution-gate.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/package-build-gate-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-package-build-gate.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless release execution plan evidence is green, command evidence is ordered and green, identity fields are valid, package build request/source-review metadata is documented, rollback/monitoring/artifact handling sections exist, credentials remain disallowed, package build decision remains blocked, and the boundary remains gate-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/package-build-execution-gate.test.ts src/__tests__/scripts/package-build-gate-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-gates/example-package-build-gate.json`
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

Add `release:package-build:gate:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example package build gate**

The example must reference the tracked release execution plan, summarize green execution-plan/hygiene/runtime/core/lint/build/diff evidence, include owner identity, target version, package request metadata, source/supply-chain review, rollback plan, monitoring plan, artifact handling, credential boundary, package build decision, and gate-only package build boundary.

- [ ] **Step 3: Update documentation**

Update project docs to say package build execution gate review is now declared, and the next concrete gap is tag creation execution gate design. Continue to state that package build execution, artifact creation, uploads, tag creation, deployment, external writes, credential use, and production readiness claims remain blocked.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/package-build-execution-gate.test.ts src/__tests__/scripts/package-build-gate-check-script.test.ts
npm run release:package-build:gate:check -- --gate docs/release-execution-gates/example-package-build-gate.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers release execution plan reuse, identity fields, package build request, source/supply-chain review, command evidence, rollback/monitoring/artifact handling, credential boundary, gate-only package boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `package build execution gate`, `executionPlanPath`, `packageBuildRequest`, `sourceReview`, `artifactHandling`, `packageBuildDecision`, `packageBuildBoundary`, `gateOnly`, and `package_build_execution_gate_review` consistently.
