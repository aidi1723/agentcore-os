# Playbook Lifecycle Sequence Evidence Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only doctor command for playbook lifecycle sequence evidence triage.

**Architecture:** Add a thin Node CLI wrapper that reuses `buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult()` as the single validation source, maps freshness findings into one status, and prints JSON with next-command guidance. Keep all behavior local and read-only.

**Tech Stack:** Node CLI, Vitest, existing playbook lifecycle sequence evidence freshness checker.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/scripts/playbook-lifecycle-sequence-evidence-doctor-script.test.ts`

- [x] Add argument parser coverage for `--evidence`, `--now`, `--current-commit`, and `--compact`.
- [x] Add a test for fresh evidence using the tracked example evidence file and deterministic commit/time overrides.
- [x] Add tests for missing evidence, invalid JSON, source commit mismatch, future recordedAt, and stale evidence.
- [x] Run the target test and confirm it fails because the doctor script does not exist.

### Task 2: Doctor CLI

**Files:**
- Create: `scripts/playbooks/doctor-playbook-lifecycle-sequence-evidence.mjs`
- Modify: `package.json`

- [x] Export `PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_DOCTOR_COMMAND`.
- [x] Parse `--evidence <path>`, `--compact`, `--now <iso-date>`, and `--current-commit <commit>`.
- [x] Check evidence path existence before invoking freshness validation.
- [x] Reuse the freshness checker to build the underlying report.
- [x] Map findings into `fresh_evidence`, `missing_evidence`, `invalid_evidence`, `invalid_provenance`, `sequence_digest_mismatch`, `source_commit_mismatch`, `future_recorded_at`, `stale_evidence`, or `invalid_recorded_at`.
- [x] Emit `productionReady: false`, `publishingPerformed: false`, and `diagnosticOnly: true`.
- [x] Add `npm run playbook:lifecycle:sequence:evidence:doctor`.
- [x] Add doctor script coverage to `test:controlled-runtime`.

### Task 3: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document `playbook:lifecycle:sequence:evidence:doctor` as a local read-only diagnostic command.
- [x] Record that the doctor does not execute suggested commands, generate evidence, mutate playbooks, refresh fixtures, write stores, publish, or claim production readiness.
- [x] Update controlled runtime test count after final verification.

### Task 4: Verification

- [x] `npm test -- src/__tests__/scripts/playbook-lifecycle-sequence-evidence-doctor-script.test.ts` — 1 file / 8 tests passed.
- [x] `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json --now 2026-07-07T03:00:00Z --current-commit 4e2b1e138987f7725f2d835c1ab738ec343d7027` — exit 0; status `fresh_evidence`.
- [x] `npm run test:controlled-runtime` — 68 files / 351 tests passed.
- [x] `npm run test:core-workflows` — all core workflow regressions passed.
- [x] `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- [x] `npm run build` — exit 0 with the same existing warning.
- [x] `git diff --check` — exit 0.
