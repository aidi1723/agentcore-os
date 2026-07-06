# Trace Retention Prune Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guarded local prune command that mutates controlled run retention only after a confirmed preview-id match.

**Architecture:** Reuse the existing retention preview parser and store helpers. The prune script runs a fresh preview, compares expected ids, and only then calls `pruneControlledExecutionRuns()`.

**Tech Stack:** Node ESM script, TypeScript alias loader, existing controlled execution store, Vitest subprocess tests.

---

## Files

- Create: `scripts/trace-operations/retention-prune.mjs`
- Create: `src/__tests__/scripts/trace-retention-prune-script.test.ts`
- Modify: `scripts/trace-operations/retention-preview.mjs`
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

## Task 1: Failing Guard Tests

- [x] Create `src/__tests__/scripts/trace-retention-prune-script.test.ts`.
- [x] Import `parseRetentionPruneArgs` from `scripts/trace-operations/retention-prune.mjs`.
- [x] Assert parsing fails without `--confirm-prune`.
- [x] Spawn the prune command without confirmation and assert non-zero exit plus unchanged store.
- [x] Spawn with stale expected ids and assert non-zero exit plus unchanged store.
- [x] Spawn with matching expected ids and assert only the expired terminal run is removed.
- [x] Run:

```bash
npm test -- src/__tests__/scripts/trace-retention-prune-script.test.ts
```

Result: failed because the prune script did not exist.

## Task 2: CLI Implementation

- [x] Export shared parsing helpers from `scripts/trace-operations/retention-preview.mjs`.
- [x] Create `scripts/trace-operations/retention-prune.mjs`.
- [x] Parse all preview policy options plus `--confirm-prune` and `--expected-pruned-run-ids`.
- [x] Run `previewControlledExecutionRunRetention()` before mutation.
- [x] Compare expected ids as sorted sets.
- [x] Call `pruneControlledExecutionRuns()` only when guards pass.
- [x] Add `trace:retention:prune` to `package.json`.
- [x] Run:

```bash
npm test -- src/__tests__/scripts/trace-retention-prune-script.test.ts
```

Result: passed, 5 tests after adding the no-candidate `none` guard.

## Task 3: Runtime Gate Inclusion

- [x] Add `src/__tests__/scripts/trace-retention-prune-script.test.ts` to `test:controlled-runtime`.
- [x] Run:

```bash
npm run test:controlled-runtime
```

Result: passed, 40 files / 206 tests.

## Task 4: Documentation And Records

- [x] Update `CHANGELOG.md`.
- [x] Update `docs/NEXT_STEPS.md`.
- [x] Update `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`.
- [x] Update `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`.
- [x] Update `memory/2026-07-06.md`.

## Task 5: Verification

- [x] Run:

```bash
npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20
npm run trace:retention:prune -- --max-age-days 30 --min-terminal-runs 20 --expected-pruned-run-ids none --confirm-prune
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0; lint/build may keep the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

Result:

- `npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20` — exit 0; local demo state reported 3 kept / 0 pruned.
- `npm run trace:retention:prune -- --max-age-days 30 --min-terminal-runs 20 --expected-pruned-run-ids none --confirm-prune` — exit 0; guard matched the fresh empty preview and performed the no-mutation handoff path.
- `npm run test:controlled-runtime` — 40 files / 206 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.
