# Playbook Lifecycle Maintenance Sequence Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only checker for the ordered playbook lifecycle maintenance sequence.

**Architecture:** Add a focused validator in `src/lib/executor/playbooks/lifecycle-maintenance-sequence.ts` that validates a parsed sequence plus proposal and migration plan reports. Add a thin CLI wrapper in `scripts/playbooks/check-playbook-lifecycle-maintenance-sequence.mjs` that reads sequence/proposal/plan JSON, reuses existing validators, and exits non-zero on findings.

**Tech Stack:** TypeScript, Vitest, Node CLI, JSON file parsing, existing lifecycle proposal and migration-plan checkers.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-maintenance-sequence.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-maintenance-sequence-script.test.ts`

- [x] Add a helper test proving a valid version update maintenance sequence passes.
- [x] Add a helper test proving missing or out-of-order commands fail closed.
- [x] Add a helper test proving sequence and migration plan proposal paths must align.
- [x] Add a helper test proving mutation and publishing policies must preserve the no-mutation/no-publish boundary.
- [x] Add CLI tests for missing `--sequence`, invalid JSON, valid sequence, and invalid sequence exit codes.
- [x] Run targeted tests and confirm they fail before implementation.

### Task 2: Sequence Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-maintenance-sequence.ts`

- [x] Export `PLAYBOOK_LIFECYCLE_MAINTENANCE_SEQUENCE_COMMAND`.
- [x] Add sequence, finding, and report types.
- [x] Validate required string fields.
- [x] Validate referenced proposal report and migration plan report.
- [x] Validate proposal path alignment between sequence and migration plan.
- [x] Validate exact ordered command coverage.
- [x] Validate handoff, fixture, runtime test, mutation, and publishing expectations.
- [x] Preserve local, read-only, non-production metadata.

### Task 3: CLI, Example Sequence, And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-maintenance-sequence.mjs`
- Create: `docs/playbook-lifecycle-maintenance-sequences/example-version-update-sequence.json`
- Modify: `package.json`

- [x] Parse `--sequence <path>` and `--compact`.
- [x] Read and parse the sequence JSON.
- [x] Read and validate the referenced proposal JSON.
- [x] Read and validate the referenced migration plan JSON.
- [x] Add a tracked example sequence JSON that references the example proposal and migration plan.
- [x] Add `npm run playbook:lifecycle:sequence:check`.
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

- [x] Document `playbook:lifecycle:sequence:check` as a local maintenance sequence gate.
- [x] Record that this does not execute commands, mutate playbooks, refresh fixtures, write stores, publish, or claim production readiness.
- [x] Update the controlled runtime test count after verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-maintenance-sequence.test.ts src/__tests__/scripts/playbook-lifecycle-maintenance-sequence-script.test.ts`
- [x] `npm run playbook:lifecycle:sequence:check -- --sequence docs/playbook-lifecycle-maintenance-sequences/example-version-update-sequence.json`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
