# Playbook Lifecycle Sequence Evidence Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only checker for recorded playbook lifecycle maintenance sequence evidence.

**Architecture:** Add a focused validator in `src/lib/executor/playbooks/lifecycle-sequence-evidence.ts` that validates parsed evidence plus a sequence report. Add a thin CLI wrapper in `scripts/playbooks/check-playbook-lifecycle-sequence-evidence.mjs` that reads evidence JSON, reads the referenced sequence/proposal/migration plan JSON files, reuses existing validators, and exits non-zero on findings.

**Tech Stack:** TypeScript, Vitest, Node CLI, JSON file parsing, existing lifecycle proposal, migration-plan, and maintenance-sequence checkers.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-sequence-evidence.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-sequence-evidence-script.test.ts`

- [x] Add a helper test proving valid recorded evidence passes.
- [x] Add a helper test proving missing or out-of-order command evidence fails closed.
- [x] Add a helper test proving command result boundary metadata is required.
- [x] Add a helper test proving mutation and publishing summaries must remain false.
- [x] Add CLI tests for missing `--evidence`, invalid JSON, valid evidence, and invalid evidence exit codes.
- [x] Run targeted tests and confirm they fail before implementation.

### Task 2: Evidence Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-sequence-evidence.ts`

- [x] Export `PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND`.
- [x] Add evidence, command result, finding, and report types.
- [x] Validate required string fields.
- [x] Validate referenced sequence report.
- [x] Validate exact command result order against the sequence report.
- [x] Validate command success fields.
- [x] Validate sequence and handoff command boundary metadata.
- [x] Validate fixture and controlled-runtime command evidence fields.
- [x] Validate mutation, publishing, and approval evidence-only boundaries.
- [x] Preserve local, read-only, non-production metadata.

### Task 3: CLI, Example Evidence, And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-sequence-evidence.mjs`
- Create: `docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json`
- Modify: `package.json`

- [x] Parse `--evidence <path>` and `--compact`.
- [x] Read and parse the evidence JSON.
- [x] Read and validate referenced sequence/proposal/migration plan JSON.
- [x] Add a tracked example evidence JSON that references the example sequence.
- [x] Add `npm run playbook:lifecycle:sequence:evidence:check`.
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

- [x] Document `playbook:lifecycle:sequence:evidence:check` as a local evidence contract gate.
- [x] Record that this does not execute commands, mutate playbooks, refresh fixtures, write stores, publish, or claim production readiness.
- [x] Update the controlled runtime test count after verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-sequence-evidence.test.ts src/__tests__/scripts/playbook-lifecycle-sequence-evidence-script.test.ts`
- [x] `npm run playbook:lifecycle:sequence:evidence:check -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
