# Trace Retention Preview CLI Design

Date: 2026-07-06

## Context

Trace Operations Hardening now has a store-level dry-run helper:
`previewControlledExecutionRunRetention()`. Maintainers still need a direct
local command to run that preview without writing custom scripts or opening the
Runtime Console.

This slice exposes the preview as a local CLI command. It remains dry-run only.

## Goal

Add a local machine-readable retention preview command:

```bash
npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20
```

The command must:

- read controlled execution runs from `.openclaw-data`;
- never mutate the store;
- print parseable JSON to stdout;
- include normalized policy, kept/pruned counts, kept/pruned ids, and per-run
  decisions;
- support `--cwd <path>` for tests and explicit workspace previews;
- reject invalid numeric options with a non-zero exit code.

## Non-Goals

- No prune command in this slice.
- No scheduled cleanup.
- No UI route or Runtime Console button.
- No artifact export.
- No fixture refresh.
- No real replay or tool execution.

## CLI Contract

Script path:

```text
scripts/trace-operations/retention-preview.mjs
```

Package script:

```json
"trace:retention:preview": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-operations/retention-preview.mjs"
```

Output shape:

```json
{
  "ok": true,
  "command": "trace:retention:preview",
  "mode": "dry_run",
  "dataCwd": "/absolute/path",
  "policy": {
    "now": 0,
    "maxAgeMs": 2592000000,
    "minTerminalRunsToKeep": 20,
    "cutoff": 0
  },
  "summary": {
    "totalRuns": 0,
    "kept": 0,
    "pruned": 0,
    "active": 0,
    "approvalBlocked": 0,
    "terminal": 0
  },
  "keptRunIds": [],
  "prunedRunIds": [],
  "decisions": []
}
```

Default policy:

- `maxAgeMs`: 30 days.
- `minTerminalRunsToKeep`: 20.
- `now`: `Date.now()`.

Supported options:

- `--max-age-ms <number>`
- `--max-age-days <number>`
- `--min-terminal-runs <integer>`
- `--now <number>`
- `--cwd <path>`

`--max-age-ms` and `--max-age-days` are mutually exclusive.

## Testing

Add `src/__tests__/scripts/trace-retention-preview-script.test.ts`.

Coverage:

- pure argument parsing rejects invalid options;
- direct command against a temporary `--cwd` prints parseable dry-run JSON;
- command output reports an expired terminal run as pruned while keeping active,
  approval-blocked, protected terminal, and in-window terminal runs;
- source JSON file remains unchanged after command execution.

## Documentation

Update:

- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-06.md`

## Verification

Run:

```bash
npm test -- src/__tests__/scripts/trace-retention-preview-script.test.ts
npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```
