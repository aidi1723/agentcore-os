# Tag Creation Execution Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only tag creation execution gate after the package build execution gate.

**Architecture:** Follow the current release gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one tag creation gate JSON file, reuses the package build gate checker, and passes parsed reports into the validator. The checker validates tag request metadata, tag policy review, source commit evidence, command evidence, release-note linkage, rollback/monitoring plans, credential boundaries, and gate-only tag boundaries without creating tags, pushing tags, uploading artifacts, deploying, using credentials, or claiming production readiness.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution gate conventions.

---

### Task 1: Tag Creation Gate Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/tag-creation-execution-gate.ts`
- Create: `scripts/release-execution/check-tag-creation-gate.mjs`
- Test: `src/__tests__/lib/executor/playbooks/tag-creation-execution-gate.test.ts`
- Test: `src/__tests__/scripts/tag-creation-gate-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/tag-creation-execution-gate.test.ts`

Expected: fail because `src/lib/executor/playbooks/tag-creation-execution-gate.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/tag-creation-gate-check-script.test.ts`

Expected: fail because `scripts/release-execution/check-tag-creation-gate.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless package build gate evidence is green, command evidence is ordered and green, identity fields are valid, tag request/source commit/tag policy metadata is documented, release note linkage exists, rollback and monitoring sections exist, credentials remain disallowed, tag creation decision remains blocked, and the boundary remains gate-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/tag-creation-execution-gate.test.ts src/__tests__/scripts/tag-creation-gate-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-execution-gates/example-tag-creation-gate.json`
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

Add `release:tag-creation:gate:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example tag creation gate**

The example must reference the tracked package build gate, summarize green package-build/hygiene/runtime/core/lint/build/diff evidence, include owner identity, target version, tag request metadata, tag policy review, source commit evidence, release-note linkage, rollback plan, monitoring plan, credential boundary, tag creation decision, and gate-only tag boundary.

- [ ] **Step 3: Update documentation**

Update project docs to say tag creation execution gate review is now declared, and the next concrete gap is artifact upload execution gate design. Continue to state that tag creation, tag push, release creation, artifact upload, deployment, external writes, credential use, and production readiness claims remain blocked.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/tag-creation-execution-gate.test.ts src/__tests__/scripts/tag-creation-gate-check-script.test.ts
npm run release:tag-creation:gate:check -- --gate docs/release-execution-gates/example-tag-creation-gate.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers package build gate reuse, identity fields, tag request, tag policy review, source commit evidence, command evidence, release-note linkage, rollback/monitoring, credential boundary, gate-only tag boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `tag creation execution gate`, `packageBuildGatePath`, `tagRequest`, `tagPolicyReview`, `sourceCommitEvidence`, `releaseNotesLinkage`, `tagCreationDecision`, `tagCreationBoundary`, `gateOnly`, and `tag_creation_execution_gate_review` consistently.
