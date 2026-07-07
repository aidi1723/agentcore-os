# Project Closeout Readiness Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only project closeout gate that aggregates current controlled-runtime readiness signals without claiming production readiness.

**Architecture:** Keep the closeout classifier in `src/lib/executor/playbooks/project-closeout-readiness.ts`. Keep CLI orchestration in `scripts/project-closeout/check-project-closeout.mjs`, reusing existing gate helpers in-process.

**Tech Stack:** TypeScript, Node ESM scripts, Vitest, existing package scripts.

---

### Task 1: Closeout Classifier

**Files:**
- Create: `src/lib/executor/playbooks/project-closeout-readiness.ts`
- Test: `src/__tests__/lib/executor/playbooks/project-closeout-readiness.test.ts`

- [x] Write failing tests for green closeout, failing child gate, and production boundary breach.
- [x] Implement `buildProjectCloseoutReadinessReport()`.
- [x] Preserve `productionReady: false`, `publishingPerformed: false`, and `closeoutOnly: true`.
- [x] Classify closed current-milestone items and deferred next-phase items.

### Task 2: CLI Wrapper

**Files:**
- Create: `scripts/project-closeout/check-project-closeout.mjs`
- Test: `src/__tests__/scripts/project-closeout-check-script.test.ts`
- Modify: `package.json`

- [x] Parse `--evidence`, `--dry-run`, `--now`, `--current-commit`, and `--compact`.
- [x] Reuse playbook control audit, lifecycle maintenance readiness, lifecycle mutation dry-run, and delivery readiness helpers.
- [x] Add `npm run project:closeout:check`.
- [x] Include closeout tests in `test:controlled-runtime`.

### Task 3: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document the current controlled-runtime milestone closeout state.
- [x] Keep production readiness, real mutation, authoring UI, connector writes, real replay, and production operations outside the current claim.
- [x] Run targeted tests.
- [x] Run actual closeout command.
- [x] Run controlled-runtime, core workflow, lint, build, and diff checks.
