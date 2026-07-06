# Trace Operations Retention Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dry-run retention preview for controlled execution run cleanup.

**Architecture:** Put all retention decisions behind one helper in the controlled execution store. The preview helper reads and reports decisions; the prune helper reuses those decisions before writing the filtered store.

**Tech Stack:** TypeScript, existing JSON store, Vitest, existing controlled runtime documentation.

---

## Files

- Modify: `src/lib/server/controlled-execution-store.ts`
- Modify: `src/__tests__/lib/server/controlled-execution-store.test.ts`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

## Task 1: Retention Preview Test

- [x] Add a failing test to `src/__tests__/lib/server/controlled-execution-store.test.ts` that imports `previewControlledExecutionRunRetention`.
- [x] Create old completed, old running, old awaiting approval, newest failed, and recent cancelled runs.
- [x] Assert the preview reports `expired_terminal_run`, `active_run`, `approval_blocked`, `minimum_terminal_retention`, and `within_retention_window`.
- [x] Assert all runs still exist after preview.
- [x] Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Result: failed because `previewControlledExecutionRunRetention` was not exported yet.

## Task 2: Store Implementation

- [x] Add `ControlledRunRetentionDecision` and `ControlledRunRetentionPreview`.
- [x] Extract a pure `buildControlledRunRetentionPreview(runs, policy)` helper.
- [x] Add `previewControlledExecutionRunRetention(policy)`.
- [x] Refactor `pruneControlledExecutionRuns(policy)` to use the same helper.
- [x] Run:

```bash
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
```

Result: passed, 7 tests.

## Task 3: Documentation And Records

- [x] Update `CHANGELOG.md` with the new Trace Operations Retention Preview entry.
- [x] Update `docs/NEXT_STEPS.md` to mark the slice complete and keep the next phase in Trace Operations Hardening.
- [x] Update the operational runbook retention section to recommend preview before prune.
- [x] Update the controlled runtime manual trace governance section.
- [x] Update `memory/2026-07-06.md` with what changed and which checks ran.

## Task 4: Verification

- [x] Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0; lint/build may keep the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

Result:

- `npm run test:controlled-runtime` — 38 files / 199 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.
