# Trace Operations Retention Preview Design

Date: 2026-07-06

## Context

AgentCore OS is now in the Trace Operations Hardening stage. The current
controlled execution store already has `pruneControlledExecutionRuns()`, but
that helper mutates storage immediately. The operational runbook requires a
maintainer to confirm that no active review, fixture refresh, or approval run
depends on a trace before cleanup.

This slice adds a dry-run retention preview so the same policy can be inspected
before deletion.

## Goal

Add a tested retention preview report for controlled execution runs.

The report must answer:

- which run ids would be pruned;
- which run ids would be kept;
- why each run was kept or pruned;
- which policy values produced the decision.

## Non-Goals

- No scheduled cleanup job.
- No UI redesign.
- No real replay.
- No tool execution.
- No route calls during fixture replay.
- No automatic fixture refresh.
- No automatic artifact export before cleanup.

## Design

Add a pure decision layer in `src/lib/server/controlled-execution-store.ts`:

```ts
export type ControlledRunRetentionDecision = {
  runId: string;
  state: ControlledExecutionRunRecord["state"];
  updatedAt: number;
  action: "keep" | "prune";
  reason:
    | "active_run"
    | "approval_blocked"
    | "minimum_terminal_retention"
    | "within_retention_window"
    | "expired_terminal_run";
};

export type ControlledRunRetentionPreview = {
  policy: {
    now: number;
    maxAgeMs: number;
    minTerminalRunsToKeep: number;
    cutoff: number;
  };
  decisions: ControlledRunRetentionDecision[];
  keptRunIds: string[];
  prunedRunIds: string[];
};
```

Add `previewControlledExecutionRunRetention(policy)` that reads the current
controlled run store and returns the report without writing storage.

Refactor `pruneControlledExecutionRuns(policy)` to use the same decision logic,
so preview and prune cannot drift.

## Decision Rules

- `running` runs are kept with reason `active_run`.
- `awaiting_approval` runs are kept with reason `approval_blocked`.
- The newest terminal runs up to `minTerminalRunsToKeep` are kept with reason
  `minimum_terminal_retention`.
- Other terminal runs newer than or equal to the cutoff are kept with reason
  `within_retention_window`.
- Other terminal runs older than the cutoff are pruned with reason
  `expired_terminal_run`.

Terminal means `completed`, `failed`, or `cancelled`.

## Testing

Extend `src/__tests__/lib/server/controlled-execution-store.test.ts`.

Required coverage:

- preview returns a full decision report and does not mutate storage;
- prune returns ids consistent with preview and mutates storage;
- active and approval-blocked runs are never pruned;
- newest terminal retention is explicit in the reason field.

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
npm test -- src/__tests__/lib/server/controlled-execution-store.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```
