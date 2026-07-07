# Playbook Lifecycle Mutation Dry-Run Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only playbook lifecycle mutation dry-run gate after structured mutation approval.

**Architecture:** Add a focused TypeScript validator for dry-run JSON and a thin Node CLI wrapper that reads one local dry-run file, reuses the mutation approval and migration plan checkers in-process, and maps all reports into one fail-closed dry-run status. Keep all outputs machine-readable and explicitly non-production.

**Tech Stack:** TypeScript validator, Node CLI, Vitest, existing mutation approval checker, existing migration plan checker.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-dry-run.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-mutation-dry-run-script.test.ts`

- [x] Add validator coverage for a valid dry-run with green approval and migration plan reports.
- [x] Add validator failure coverage for non-green approval, non-green migration plan, invalid target path, and breached execution boundary.
- [x] Add parser coverage for `--dry-run`, `--now`, `--current-commit`, and `--compact`.
- [x] Add a successful CLI test using the tracked example dry-run and deterministic commit/time.
- [x] Add injected CLI failure coverage for non-green approval.
- [x] Run the target tests and confirm they fail because the validator and script do not exist.

### Task 2: Dry-Run Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-dry-run.ts`
- Create: `docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json`

- [x] Export `PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND`.
- [x] Define the dry-run contract and report/finding types.
- [x] Validate required string fields: `dryRunId`, `approvalPath`, `migrationPlanPath`, `owner`, `createdAt`, `mutationType`, and `targetPlaybookId`.
- [x] Require `mutationType: "registered_playbook_contract_update"`.
- [x] Require referenced approval report and migration plan report to be green.
- [x] Require `targetPlaybookId` to match the migration plan target playbook id.
- [x] Require at least one planned target with `kind: "registered_playbook_contract"` and relative path under `src/lib/executor/playbooks/`.
- [x] Require fixture impact to cover migration plan expected fixture ids.
- [x] Require execution boundary to preserve dry-run-only and no side effects.
- [x] Emit `readyForLifecycleMutationDryRun`, `status`, `checks`, `findings`, `nextCommand`, and `nextAction`.

### Task 3: Dry-Run CLI

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-dry-run.mjs`
- Modify: `package.json`

- [x] Parse `--dry-run <path>`, `--compact`, `--now <iso-or-date>`, and `--current-commit <commit>`.
- [x] Read the dry-run JSON locally.
- [x] Reuse `buildPlaybookLifecycleMutationApprovalCliResult()` with `dryRun.approvalPath`.
- [x] Reuse `buildPlaybookLifecycleMigrationPlanCliResult()` with `dryRun.migrationPlanPath`.
- [x] Validate the dry-run with the referenced reports.
- [x] Add `npm run playbook:lifecycle:mutation:dry-run:check`.
- [x] Add validator and script coverage to `test:controlled-runtime`.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document `playbook:lifecycle:mutation:dry-run:check` as a local dry-run gate.
- [x] Record that this command does not execute migrations, mutate playbooks, refresh fixtures, write stores, call external connectors, publish, or claim production readiness.
- [x] Update controlled runtime test count after final verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-dry-run.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-dry-run-script.test.ts`
- [x] `npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`

Verification evidence so far:

- RED: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-dry-run.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-dry-run-script.test.ts` failed because `src/lib/executor/playbooks/lifecycle-mutation-dry-run.ts` and `scripts/playbooks/check-playbook-lifecycle-mutation-dry-run.mjs` did not exist.
- GREEN: same target command passed after adding validator, CLI, example dry-run JSON, package script, and fixture id reporting in the migration plan report — 2 files / 10 tests passed.
- `npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027` — exit 0; reported `dry_run_ready`, `readyForLifecycleMutationDryRun: true`, and `dryRunOnly: true`.
- `npm run test:controlled-runtime` — 73 files / 376 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.
