# Playbook Lifecycle Handoff Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only checklist command for playbook versioning and deprecation handoff readiness.

**Architecture:** Add a focused helper in `src/lib/executor/playbooks/lifecycle-handoff.ts` that consumes existing control-audit and lifecycle-review reports. Add a thin CLI wrapper in `scripts/playbooks/` that builds those reports from the registered catalog and existing governed fixture catalog, then wire the command into `package.json`.

**Tech Stack:** TypeScript, Vitest, Node CLI, existing playbook catalog, existing control audit, existing lifecycle review diagnostic.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-handoff.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-handoff-script.test.ts`

- [x] Add a helper test proving current registered reports are ready for lifecycle handoff.
- [x] Add a helper test proving due lifecycle review findings block handoff.
- [x] Add a helper test proving deprecated replacement chains are summarized when present.
- [x] Add CLI argument parsing tests for default, `--compact`, and `--now`.
- [x] Add CLI result tests for current catalog and deterministic due-review failure.
- [x] Run targeted tests and confirm they fail before implementation.

### Task 2: Handoff Helper

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-handoff.ts`

- [x] Export `PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND`.
- [x] Add report, check, finding, and deprecated replacement summary types.
- [x] Build readiness from `controlAudit.ok && lifecycleReview.ok`.
- [x] Add findings for non-green control audit and non-green lifecycle review.
- [x] Preserve read-only, local, non-production metadata.

### Task 3: CLI And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-handoff.mjs`
- Modify: `package.json`

- [x] Parse `--compact` and `--now YYYY-MM-DD`.
- [x] Build control audit from registered playbooks and governed fixture catalog.
- [x] Build lifecycle review from registered playbooks.
- [x] Add `npm run playbook:lifecycle:handoff`.
- [x] Add helper and script tests to `test:controlled-runtime`.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document `playbook:lifecycle:handoff` as the local version/deprecation handoff checklist.
- [x] Record that this aggregates existing gates and does not add authoring UI, migration execution, fixture mutation, publishing, or production readiness.
- [x] Update the controlled runtime test count after verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-handoff.test.ts src/__tests__/scripts/playbook-lifecycle-handoff-script.test.ts`
- [x] `npm run playbook:lifecycle:handoff`
- [x] `npm run playbook:lifecycle:handoff -- --now 2027-01-03 --compact`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
