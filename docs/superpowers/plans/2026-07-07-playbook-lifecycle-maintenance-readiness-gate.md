# Playbook Lifecycle Maintenance Readiness Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only maintenance readiness gate that aggregates lifecycle handoff and sequence evidence doctor state.

**Architecture:** Add a thin Node CLI wrapper that reuses `buildPlaybookLifecycleHandoffCliResult()` and `doctorPlaybookLifecycleSequenceEvidence()` in-process. The wrapper maps those reports into one readiness status and exits non-zero unless both checks are green.

**Tech Stack:** Node CLI, Vitest, existing playbook lifecycle handoff helper, existing sequence evidence doctor helper.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/scripts/playbook-lifecycle-maintenance-ready-script.test.ts`

- [x] Add parser coverage for `--evidence`, `--now`, `--current-commit`, and `--compact`.
- [x] Add a successful test using the tracked example evidence and deterministic commit/time.
- [x] Add injected failure tests for handoff not ready, evidence not ready, and both not ready.
- [x] Run the target test and confirm it fails because the readiness script does not exist.

### Task 2: Maintenance Ready CLI

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-maintenance-ready.mjs`
- Modify: `package.json`

- [x] Export `PLAYBOOK_LIFECYCLE_MAINTENANCE_READY_COMMAND`.
- [x] Parse `--evidence <path>`, `--compact`, `--now <iso-or-date>`, and `--current-commit <commit>`.
- [x] Normalize handoff `now` to `YYYY-MM-DD` while passing full `now` to the evidence doctor.
- [x] Reuse lifecycle handoff and sequence evidence doctor helpers.
- [x] Emit `readyForLifecycleMaintenance`, `status`, `checks`, `findings`, `nextCommand`, and `nextAction`.
- [x] Keep `productionReady: false`, `publishingPerformed: false`, and `readinessOnly: true`.
- [x] Add `npm run playbook:lifecycle:maintenance:ready`.
- [x] Add readiness script coverage to `test:controlled-runtime`.

### Task 3: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document `playbook:lifecycle:maintenance:ready` as a local readiness gate.
- [x] Record that this command does not execute suggested commands, generate evidence, mutate playbooks, refresh fixtures, write stores, publish, or claim production readiness.
- [x] Update controlled runtime test count after final verification.

### Task 4: Verification

- [x] `npm test -- src/__tests__/scripts/playbook-lifecycle-maintenance-ready-script.test.ts`
- [x] `npm run playbook:lifecycle:maintenance:ready -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`

Verification evidence:

- `npm test -- src/__tests__/scripts/playbook-lifecycle-maintenance-ready-script.test.ts` — 1 file / 6 tests passed.
- `npm run playbook:lifecycle:maintenance:ready -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027` — exit 0; reported `ready_for_lifecycle_maintenance`, `readyForLifecycleMaintenance: true`, and `nextCommand: "npm run trace:fixtures --silent"`.
- `npm run test:controlled-runtime` — 69 files / 357 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.
