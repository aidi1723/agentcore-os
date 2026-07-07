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

- [ ] Add a helper test proving a valid version update migration plan passes.
- [ ] Add a helper test proving missing required commands fail closed.
- [ ] Add a helper test proving invalid referenced proposals fail closed.
- [ ] Add a helper test proving mutation policies other than `no_mutation_until_plan_approved` fail closed.
- [ ] Add CLI tests for missing `--plan`, invalid JSON, valid plan, and invalid plan exit codes.
- [ ] Run targeted tests and confirm they fail before implementation.

### Task 2: Migration Plan Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-migration-plan.ts`

- [ ] Export `PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND`.
- [ ] Add plan, fixture review, finding, and report types.
- [ ] Validate required string fields.
- [ ] Validate `migrationType`.
- [ ] Validate linked proposal report.
- [ ] Validate proposal and migration plan alignment.
- [ ] Validate required command coverage.
- [ ] Validate planned changes and rollback plan.
- [ ] Validate fixture review expectations for new/version changes.
- [ ] Validate mutation policy.
- [ ] Preserve local, read-only, non-production metadata.

### Task 3: CLI, Example Plan, And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-migration-plan.mjs`
- Create: `docs/playbook-lifecycle-migration-plans/example-version-update-plan.json`
- Modify: `package.json`

- [ ] Parse `--plan <path>` and `--compact`.
- [ ] Read and parse the migration plan JSON.
- [ ] Read and parse the referenced proposal JSON.
- [ ] Validate the referenced proposal with existing proposal checker semantics.
- [ ] Add a tracked example migration plan JSON that references the example proposal.
- [ ] Add `npm run playbook:lifecycle:migration:plan:check`.
- [ ] Add helper and script tests to `test:controlled-runtime`.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] Document `playbook:lifecycle:migration:plan:check` as a local migration planning gate.
- [ ] Record that this does not mutate playbooks, fixtures, stores, external connectors, or release evidence.
- [ ] Update the controlled runtime test count after verification.

### Task 5: Verification

- [ ] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-migration-plan.test.ts src/__tests__/scripts/playbook-lifecycle-migration-plan-script.test.ts`
- [ ] `npm run playbook:lifecycle:migration:plan:check -- --plan docs/playbook-lifecycle-migration-plans/example-version-update-plan.json`
- [ ] `npm run test:controlled-runtime`
- [ ] `npm run test:core-workflows`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
