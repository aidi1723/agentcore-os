# Playbook Lifecycle Migration Plan Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only checker for playbook lifecycle migration plans.

**Architecture:** Add a focused validator in `src/lib/executor/playbooks/lifecycle-migration-plan.ts` that validates a parsed plan and a referenced proposal report. Add a thin CLI wrapper in `scripts/playbooks/check-playbook-lifecycle-migration-plan.mjs` that reads a plan JSON, reads the referenced proposal JSON, validates both, and exits non-zero on findings.

**Tech Stack:** TypeScript, Vitest, Node CLI, JSON file parsing, existing lifecycle proposal checker.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-migration-plan.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-migration-plan-script.test.ts`

- [x] Add a helper test proving a valid version update migration plan passes.
- [x] Add a helper test proving missing required commands fail closed.
- [x] Add a helper test proving invalid referenced proposals fail closed.
- [x] Add a helper test proving mutation policies other than `no_mutation_until_plan_approved` fail closed.
- [x] Add CLI tests for missing `--plan`, invalid JSON, valid plan, and invalid plan exit codes.
- [x] Run targeted tests and confirm they fail before implementation.

### Task 2: Migration Plan Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-migration-plan.ts`

- [x] Export `PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND`.
- [x] Add plan, fixture review, finding, and report types.
- [x] Validate required string fields.
- [x] Validate `migrationType`.
- [x] Validate linked proposal report.
- [x] Validate proposal and migration plan alignment.
- [x] Validate required command coverage.
- [x] Validate planned changes and rollback plan.
- [x] Validate fixture review expectations for new/version changes.
- [x] Validate mutation policy.
- [x] Preserve local, read-only, non-production metadata.

### Task 3: CLI, Example Plan, And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-migration-plan.mjs`
- Create: `docs/playbook-lifecycle-migration-plans/example-version-update-plan.json`
- Modify: `package.json`

- [x] Parse `--plan <path>` and `--compact`.
- [x] Read and parse the migration plan JSON.
- [x] Read and parse the referenced proposal JSON.
- [x] Validate the referenced proposal with existing proposal checker semantics.
- [x] Add a tracked example migration plan JSON that references the example proposal.
- [x] Add `npm run playbook:lifecycle:migration:plan:check`.
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

- [x] Document `playbook:lifecycle:migration:plan:check` as a local migration planning gate.
- [x] Record that this does not mutate playbooks, fixtures, stores, external connectors, or release evidence.
- [x] Update the controlled runtime test count after verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-migration-plan.test.ts src/__tests__/scripts/playbook-lifecycle-migration-plan-script.test.ts`
- [x] `npm run playbook:lifecycle:migration:plan:check -- --plan docs/playbook-lifecycle-migration-plans/example-version-update-plan.json`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
