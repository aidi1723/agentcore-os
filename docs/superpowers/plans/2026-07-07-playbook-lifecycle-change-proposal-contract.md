# Playbook Lifecycle Change Proposal Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only checker for playbook lifecycle change proposals.

**Architecture:** Add a focused validator in `src/lib/executor/playbooks/lifecycle-change-proposal.ts` that validates a parsed JSON proposal and returns a deterministic report. Add a thin CLI wrapper in `scripts/playbooks/check-playbook-lifecycle-change-proposal.mjs` that reads a proposal file from `--proposal`, validates it, and exits non-zero on findings.

**Tech Stack:** TypeScript, Vitest, Node CLI, JSON file parsing, existing npm script pattern.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-change-proposal.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-change-proposal-script.test.ts`

- [ ] Add a helper test proving a valid version update proposal passes.
- [ ] Add a helper test proving missing required commands fail closed.
- [ ] Add a helper test proving deprecation proposals require `replacementPlaybookId` and `deprecatedAt`.
- [ ] Add CLI tests for missing `--proposal`, invalid JSON, valid proposal, and invalid proposal exit codes.
- [ ] Run targeted tests and confirm they fail before implementation.

### Task 2: Proposal Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-change-proposal.ts`

- [ ] Export `PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND`.
- [ ] Add proposal, finding, and report types.
- [ ] Validate required string fields.
- [ ] Validate `changeType`.
- [ ] Validate required command coverage.
- [ ] Validate fixture expectations for new/version changes.
- [ ] Validate deprecation-specific metadata.
- [ ] Preserve local, read-only, non-production metadata.

### Task 3: CLI And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-change-proposal.mjs`
- Create: `docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json`
- Modify: `package.json`

- [ ] Parse `--proposal <path>` and `--compact`.
- [ ] Read and parse the proposal JSON.
- [ ] Check referenced `specPath` and `planPath` relative to the current working directory.
- [ ] Add a tracked example proposal JSON that references this phase spec and plan.
- [ ] Add `npm run playbook:lifecycle:change:check`.
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

- [ ] Document `playbook:lifecycle:change:check` as a local proposal-intake gate.
- [ ] Record that this does not mutate playbooks, fixtures, stores, external connectors, or release evidence.
- [ ] Update the controlled runtime test count after verification.

### Task 5: Verification

- [ ] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-change-proposal.test.ts src/__tests__/scripts/playbook-lifecycle-change-proposal-script.test.ts`
- [ ] `npm run playbook:lifecycle:change:check -- --proposal docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json`
- [ ] `npm run test:controlled-runtime`
- [ ] `npm run test:core-workflows`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
