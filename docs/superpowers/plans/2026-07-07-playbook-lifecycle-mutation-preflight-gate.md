# Playbook Lifecycle Mutation Preflight Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only preflight gate before implementing or running any real playbook lifecycle mutation executor.

**Architecture:** Keep validation logic in `src/lib/executor/playbooks/lifecycle-mutation-preflight.ts`. Keep CLI orchestration in `scripts/playbooks/check-playbook-lifecycle-mutation-preflight.mjs`, reusing existing closeout and dry-run helpers in-process.

**Tech Stack:** TypeScript, Node ESM scripts, Vitest, existing package scripts.

---

### Task 1: Preflight Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-preflight.ts`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-preflight.test.ts`

- [x] Write failing tests for green preflight, closeout failure, review-only target rejection, and execution boundary breach.
- [x] Implement `validatePlaybookLifecycleMutationPreflight()`.
- [x] Preserve `productionReady: false`, `publishingPerformed: false`, and `preflightOnly: true`.
- [x] Require `update_contract` target intent before mutation executor work.

### Task 2: CLI Wrapper

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-preflight.mjs`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-preflight-script.test.ts`
- Modify: `package.json`
- Modify: `docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json`

- [x] Parse `--evidence`, `--dry-run`, `--now`, `--current-commit`, and `--compact`.
- [x] Reuse `project:closeout:check` and `playbook:lifecycle:mutation:dry-run:check` helpers.
- [x] Add `npm run playbook:lifecycle:mutation:preflight:check`.
- [x] Include preflight tests in `test:controlled-runtime`.
- [x] Update the tracked dry-run example to use `operation: "update_contract"`.

### Task 3: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document Productionization Preparation as the active next phase.
- [x] Document mutation preflight as a no-mutation gate.
- [x] Run targeted tests.
- [x] Run actual preflight command.
- [x] Run controlled-runtime, core workflow, lint, build, and diff checks.
