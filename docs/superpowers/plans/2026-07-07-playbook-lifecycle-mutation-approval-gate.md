# Playbook Lifecycle Mutation Approval Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only playbook lifecycle mutation approval receipt gate after maintenance readiness.

**Architecture:** Add a focused TypeScript validator for approval receipt JSON and a thin Node CLI wrapper that reads one local approval file, reuses the existing maintenance readiness helper in-process, and maps both reports into one fail-closed approval status. Keep the gate read-only and non-production.

**Tech Stack:** TypeScript validator, Node CLI, Vitest, existing lifecycle maintenance readiness helper.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-approval.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-mutation-approval-script.test.ts`

- [x] Add validator coverage for a valid approval receipt with green readiness.
- [x] Add validator failure coverage for invalid decision, non-green readiness, and breached mutation boundary.
- [x] Add parser coverage for `--approval`, `--now`, `--current-commit`, and `--compact`.
- [x] Add a successful CLI test using the tracked example approval receipt and deterministic commit/time.
- [x] Add injected CLI failure coverage for non-green readiness.
- [x] Run the target tests and confirm they fail because the validator and script do not exist.

### Task 2: Approval Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-approval.ts`
- Create: `docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json`

- [x] Export `PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND`.
- [x] Define the approval receipt contract and report/finding types.
- [x] Validate required string fields: `approvalId`, `evidencePath`, `approver`, `approvedAt`, `decision`, and `approvalScope`.
- [x] Require `decision: "approved"` and `approvalScope: "playbook_lifecycle_mutation"`.
- [x] Require current maintenance readiness to be green.
- [x] Require embedded readiness summary to preserve `ready_for_lifecycle_maintenance`, `readyForLifecycleMaintenance: true`, `productionReady: false`, `publishingPerformed: false`, and `readinessOnly: true`.
- [x] Require `mutationBoundary` to preserve no execution, no fixture refresh, no store writes, no external writes, and no publishing.
- [x] Emit `approvedForLifecycleMutation`, `status`, `checks`, `findings`, `nextCommand`, and `nextAction`.

### Task 3: Approval CLI

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-approval.mjs`
- Modify: `package.json`

- [x] Parse `--approval <path>`, `--compact`, `--now <iso-or-date>`, and `--current-commit <commit>`.
- [x] Read the approval JSON locally.
- [x] Reuse `buildPlaybookLifecycleMaintenanceReadyCliResult()` with `approval.evidencePath`.
- [x] Validate the approval receipt with the current readiness report.
- [x] Add `npm run playbook:lifecycle:mutation:approval:check`.
- [x] Add script coverage to `test:controlled-runtime`.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document `playbook:lifecycle:mutation:approval:check` as a local approval receipt gate.
- [x] Record that this command does not execute migrations, mutate playbooks, refresh fixtures, write stores, call external connectors, publish, or claim production readiness.
- [x] Update controlled runtime test count after final verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-approval.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-approval-script.test.ts`
- [x] `npm run playbook:lifecycle:mutation:approval:check -- --approval docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`

Verification evidence so far:

- RED: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-approval.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-approval-script.test.ts` failed because `src/lib/executor/playbooks/lifecycle-mutation-approval.ts` and `scripts/playbooks/check-playbook-lifecycle-mutation-approval.mjs` did not exist.
- GREEN: same target command passed after adding validator, CLI, example approval receipt, and package script — 2 files / 9 tests passed.
- `npm run playbook:lifecycle:mutation:approval:check -- --approval docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027` — exit 0; reported `approved_for_lifecycle_mutation`, `approvedForLifecycleMutation: true`, and `approvalOnly: true`.
- `npm run test:controlled-runtime` — 71 files / 366 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.
