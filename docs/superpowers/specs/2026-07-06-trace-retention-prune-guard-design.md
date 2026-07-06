# Trace Retention Prune Guard Design

Date: 2026-07-06

## Context

Trace retention now has:

- a store-level dry-run helper: `previewControlledExecutionRunRetention()`;
- a local operator preview command: `npm run trace:retention:preview`.

The final closeout gap is a guarded mutation path. Maintainers should be able
to prune expired terminal controlled runs, but only after confirming the exact
ids shown by a fresh preview.

## Goal

Add a guarded local prune command:

```bash
npm run trace:retention:prune -- \
  --max-age-days 30 \
  --min-terminal-runs 20 \
  --expected-pruned-run-ids run-a,run-b \
  --confirm-prune
```

The command must:

- run a fresh retention preview first;
- refuse to mutate unless `--confirm-prune` is present;
- refuse to mutate unless `--expected-pruned-run-ids` exactly matches current
  preview `prunedRunIds`;
- preserve active and approval-blocked runs through the existing store helper;
- print a machine-readable handoff JSON report;
- support `--cwd`, `--now`, `--max-age-ms`, `--max-age-days`, and
  `--min-terminal-runs`;
- remain local-only.

## Non-Goals

- No scheduled cleanup.
- No UI or API route.
- No automatic artifact export.
- No fixture refresh.
- No real replay.
- No deletion outside `controlled-execution-runs.json`.

## CLI Contract

Script path:

```text
scripts/trace-operations/retention-prune.mjs
```

Package script:

```json
"trace:retention:prune": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-operations/retention-prune.mjs"
```

Required guard options:

- `--confirm-prune`
- `--expected-pruned-run-ids <csv>`

`--expected-pruned-run-ids none` is accepted only when the fresh preview has no
prune candidates. In that case the command exits 0 and reports no mutation.

Output shape:

```json
{
  "ok": true,
  "command": "trace:retention:prune",
  "mode": "guarded_prune",
  "dataCwd": "/absolute/path",
  "guard": {
    "confirmed": true,
    "expectedPrunedRunIds": ["run-a"],
    "matchedPreview": true
  },
  "preview": {},
  "prune": {
    "prunedRunIds": ["run-a"],
    "keptRunIds": ["run-b"]
  },
  "handoff": {
    "pruned": 1,
    "kept": 1,
    "activeKept": 0,
    "approvalBlockedKept": 0
  }
}
```

On guard failure, stderr must explain the issue and the command must exit
non-zero without mutating storage.

## Testing

Add `src/__tests__/scripts/trace-retention-prune-script.test.ts`.

Coverage:

- parsing rejects missing confirmation and invalid expected ids;
- subprocess without `--confirm-prune` exits non-zero and does not mutate the
  store;
- subprocess with stale expected ids exits non-zero and does not mutate the
  store;
- subprocess with matching expected ids prunes only expired terminal runs and
  keeps active, approval-blocked, protected terminal, and in-window terminal
  runs.

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
npm test -- src/__tests__/scripts/trace-retention-prune-script.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```
