# Playbook Lifecycle Sequence Evidence Freshness Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only freshness and provenance checker for recorded playbook lifecycle sequence evidence.

**Architecture:** Add a focused validator in `src/lib/executor/playbooks/lifecycle-sequence-evidence-freshness.ts` that validates evidence provenance against a sequence evidence report, current commit, current time, and a computed sequence digest. Add a thin CLI wrapper in `scripts/playbooks/check-playbook-lifecycle-sequence-evidence-freshness.mjs` that reads evidence/sequence/proposal/migration plan JSON, reuses existing validators, computes sequence digest, and exits non-zero on findings.

**Tech Stack:** TypeScript, Vitest, Node CLI, JSON file parsing, SHA-256 hashing via Node `crypto`, existing lifecycle proposal, migration-plan, maintenance-sequence, and sequence-evidence checkers.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-sequence-evidence-freshness.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-sequence-evidence-freshness-script.test.ts`

- [x] Add a helper test proving fresh evidence with matching commit and sequence digest passes.
- [x] Add a helper test proving stale evidence fails closed.
- [x] Add a helper and CLI test proving future-dated evidence fails closed.
- [x] Add a helper test proving sequence digest mismatch fails closed.
- [x] Add a helper test proving commit mismatch fails closed.
- [x] Add CLI tests for missing `--evidence`, invalid JSON, valid freshness evidence, invalid freshness evidence, `--now`, and `--current-commit`.
- [x] Run targeted tests and confirm they fail before implementation.

### Task 2: Freshness Validator

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-sequence-evidence-freshness.ts`

- [x] Export `PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND`.
- [x] Add freshness finding and report types.
- [x] Validate referenced sequence evidence report.
- [x] Validate provenance shape.
- [x] Validate sequence digest alignment.
- [x] Validate commit alignment.
- [x] Validate evidence age against `maxAgeHours`.
- [x] Reject evidence whose `recordedAt` is later than review `now`.
- [x] Preserve local, read-only, non-production metadata.

### Task 3: CLI, Example Provenance, And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-sequence-evidence-freshness.mjs`
- Modify: `docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json`
- Modify: `package.json`

- [x] Parse `--evidence <path>`, `--compact`, `--now <iso-date>`, and `--current-commit <commit>`.
- [x] Read and parse the evidence JSON.
- [x] Read and validate referenced sequence/proposal/migration plan JSON.
- [x] Compute SHA-256 digest of the sequence file.
- [x] Add provenance metadata to the tracked example evidence JSON.
- [x] Add `npm run playbook:lifecycle:sequence:evidence:freshness:check`.
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

- [x] Document `playbook:lifecycle:sequence:evidence:freshness:check` as a local freshness/provenance gate.
- [x] Record that this does not execute commands, generate evidence, mutate playbooks, refresh fixtures, write stores, publish, or claim production readiness.
- [x] Update the controlled runtime test count after verification.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-sequence-evidence-freshness.test.ts src/__tests__/scripts/playbook-lifecycle-sequence-evidence-freshness-script.test.ts` — 2 files / 11 tests passed.
- [x] `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027` — exit 0; `ok: true`, `ageHours: 0.5`, matching commit and sequence digest.
- [x] `npm run test:controlled-runtime` — 67 files / 343 tests passed.
- [x] `npm run test:core-workflows` — all core workflow regressions passed.
- [x] `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- [x] `npm run build` — exit 0 with the same existing warning.
- [x] `git diff --check` — exit 0.
