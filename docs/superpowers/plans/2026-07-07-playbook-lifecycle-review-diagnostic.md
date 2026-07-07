# Playbook Lifecycle Review Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only playbook lifecycle review diagnostic command.

**Architecture:** Add a focused lifecycle review helper under `src/lib/executor/playbooks/`, then expose it through a thin CLI wrapper in `scripts/playbooks/`. Keep this separate from the existing control audit so lifecycle freshness can become a maintainer workflow without changing runtime behavior.

**Tech Stack:** TypeScript, Vitest, Node CLI, existing registered playbook catalog.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-review.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-review-script.test.ts`

- [x] Add a helper test proving current active playbooks are not due on `2026-07-07`.
- [x] Add a helper test proving active playbooks fail closed when `now` reaches the computed due date.
- [x] Add a script test for default and `--compact` argument parsing.
- [x] Add a script test proving `--now` creates deterministic due-review output.
- [x] Run the targeted tests and confirm they fail before implementation.

### Task 2: Lifecycle Review Helper

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-review.ts`

- [x] Export `PLAYBOOK_LIFECYCLE_REVIEW_COMMAND`.
- [x] Add report, item, and finding types.
- [x] Compute next review dates with UTC date-only math.
- [x] Include only active playbooks in due-review findings.
- [x] Keep output local, JSON-serializable, and diagnostic-only.

### Task 3: CLI And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-review.mjs`
- Modify: `package.json`

- [x] Add CLI parsing for `--compact` and `--now YYYY-MM-DD`.
- [x] Wire the helper to `listControlledPlaybooks()`.
- [x] Add `npm run playbook:lifecycle:review`.
- [x] Add lifecycle review tests to `test:controlled-runtime`.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document the new local diagnostic command.
- [x] Record that this is a lifecycle maintenance diagnostic, not full authoring/versioning/deprecation.
- [x] Update the controlled runtime test count after verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-review.test.ts src/__tests__/scripts/playbook-lifecycle-review-script.test.ts`
- [x] `npm run playbook:lifecycle:review`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
