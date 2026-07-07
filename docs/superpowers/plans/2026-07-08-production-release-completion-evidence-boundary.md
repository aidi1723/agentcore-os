# Production Release Completion Evidence Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local post-execution production release completion evidence checker without executing production release actions.

**Architecture:** Follow the existing release checker pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one local evidence JSON file, reuses the release execution approval boundary checker, and validates either schema-only example evidence or actual operator-recorded production completion evidence.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release execution gate conventions.

---

### Task 1: Production Release Completion Evidence Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/production-release-completion-evidence.ts`
- Create: `scripts/release-execution/check-production-release-completion-evidence.mjs`
- Test: `src/__tests__/lib/executor/playbooks/production-release-completion-evidence.test.ts`
- Test: `src/__tests__/scripts/production-release-completion-evidence-check-script.test.ts`

- [x] **Step 1: Write failing library tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/production-release-completion-evidence.test.ts
```

Expected: fail because `src/lib/executor/playbooks/production-release-completion-evidence.ts` does not exist.

- [x] **Step 2: Write failing CLI tests**

Run:

```bash
npm test -- src/__tests__/scripts/production-release-completion-evidence-check-script.test.ts
```

Expected: fail because `scripts/release-execution/check-production-release-completion-evidence.mjs` does not exist.

- [x] **Step 3: Implement validator and CLI**

The validator must:

- require green release execution approval boundary evidence;
- allow `example_schema_only` evidence to validate without claiming production completion;
- allow `operator_recorded_actual_execution` evidence to claim completion only when every release action, credential, verification, monitoring, rollback, audit, and checker boundary field is valid;
- reject example evidence that claims performed production actions;
- reject actual evidence with missing or failed action evidence;
- keep `checkerExecutedReleaseActions: false` and `checkerUsedCredentials: false`.

- [x] **Step 4: Verify targeted tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/production-release-completion-evidence.test.ts src/__tests__/scripts/production-release-completion-evidence-check-script.test.ts
```

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-completion-evidence/example-production-release-completion-evidence.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `memory/2026-07-08.md`

- [x] **Step 1: Add npm script and controlled-runtime coverage**

Add `release:completion:evidence:check` and include both new tests in `test:controlled-runtime`.

- [x] **Step 2: Add tracked schema-only example evidence**

The example must reference `docs/release-execution-approvals/example-release-execution-approval-boundary.json`, use `evidenceMode: "example_schema_only"`, keep all release actions unperformed, and preserve `productionReady: false` and `publishingPerformed: false`.

- [x] **Step 3: Update documentation**

Update project docs to say post-execution completion evidence can now be validated locally. Continue to state that the checker itself does not publish, tag, package, upload, deploy, perform external writes, use credentials, or run production verification.

- [x] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/production-release-completion-evidence.test.ts src/__tests__/scripts/production-release-completion-evidence-check-script.test.ts
npm run release:completion:evidence:check -- --evidence docs/release-completion-evidence/example-production-release-completion-evidence.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers example-only mode, actual operator evidence mode, upstream approval reuse, action evidence, credentials, verification, monitoring, rollback, audit, checker boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `productionReleaseCompletionEvidence`, `evidenceMode`, `releaseActionEvidence`, `completionEvidenceOnly`, `schemaExampleOnly`, and `productionReleaseCompleted` consistently.
