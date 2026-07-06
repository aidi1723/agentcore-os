# Trace Retention Preview CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local dry-run command for controlled run retention preview.

**Architecture:** The CLI wraps `previewControlledExecutionRunRetention()` and formats a stable JSON report. It parses options locally, changes process cwd only when `--cwd` is provided, and never calls the mutating prune helper.

**Tech Stack:** Node ESM script, TypeScript alias loader, existing controlled execution store, Vitest subprocess tests.

---

## Files

- Create: `scripts/trace-operations/retention-preview.mjs`
- Create: `src/__tests__/scripts/trace-retention-preview-script.test.ts`
- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

## Task 1: Failing CLI Tests

- [x] Create `src/__tests__/scripts/trace-retention-preview-script.test.ts`.
- [x] Import `parseRetentionPreviewArgs` from the new script path.
- [x] Add an invalid option parsing assertion.
- [x] Spawn `npm run trace:retention:preview --silent -- --cwd <tmp> --now 10000 --max-age-ms 1000 --min-terminal-runs 1`.
- [x] Assert JSON output shape, dry-run mode, reason coverage, and unchanged source file.
- [x] Run:

```bash
npm test -- src/__tests__/scripts/trace-retention-preview-script.test.ts
```

Result: failed because the script path did not exist yet.

## Task 2: CLI Implementation

- [x] Create `scripts/trace-operations/retention-preview.mjs`.
- [x] Export `parseRetentionPreviewArgs(argv)` and `buildRetentionPreviewOutput(preview, dataCwd)`.
- [x] Parse `--max-age-ms`, `--max-age-days`, `--min-terminal-runs`, `--now`, and `--cwd`.
- [x] Reject invalid values and mutually exclusive age options.
- [x] Call `previewControlledExecutionRunRetention(policy)`.
- [x] Print JSON and set non-zero exit code on errors.
- [x] Add `trace:retention:preview` to `package.json`.
- [x] Run:

```bash
npm test -- src/__tests__/scripts/trace-retention-preview-script.test.ts
```

Result: passed, 2 tests.

## Task 3: Runtime Gate Inclusion

- [x] Add `src/__tests__/scripts/trace-retention-preview-script.test.ts` to `test:controlled-runtime`.
- [x] Run:

```bash
npm run test:controlled-runtime
```

Result: passed with 39 files / 201 tests.

## Task 4: Documentation And Records

- [x] Update `CHANGELOG.md`.
- [x] Update `docs/NEXT_STEPS.md`.
- [x] Update `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md` with the command.
- [x] Update `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`.
- [x] Update `memory/2026-07-06.md`.

## Task 5: Verification

- [x] Run:

```bash
npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0; lint/build may keep the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

Result:

- `npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20` — exit 0; local dry-run reported 3 kept / 0 pruned runs.
- `npm run test:controlled-runtime` — 39 files / 201 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.
