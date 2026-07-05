# Runtime Console Failure Recovery Design

## Goal

Let Runtime Console expose safe, auditable recovery actions for failed controlled runs without turning failure handling into an unrestricted replay mechanism.

## Scope

In scope:

- Derive failed-step recovery metadata for console summaries.
- Add a server-side retry path for a single failed controlled step.
- Allow retry only when the playbook step explicitly declares `onFailure.action === "retry"`.
- Preserve completed / skipped prior step results and start execution at the failed step.
- Record console-initiated recovery audit metadata in durable controlled run state.
- Add Runtime Console controls for eligible failed runs.

Out of scope:

- Retrying completed or cancelled runs.
- Retrying approval rejection failures.
- Retrying failed steps whose playbook policy is `await_human` or `fail_run`.
- Multi-step rollback.
- Arbitrary step selection by the user.
- Automatic retry polling.

## Recovery Model

The first recovery slice supports one operation:

```text
POST /api/runtime/executor/controlled-runs/[runId]/retry
```

The operation retries the first failed step in playbook order when:

- run exists,
- run state is `failed`,
- failed step record exists,
- failed step exists in `run.plan.steps`,
- failed step has `onFailure.action === "retry"`,
- failed step attempts are below the playbook retry budget,
- no pending approval blocks the failed step.

The operation must not retry:

- completed runs,
- cancelled runs,
- running runs,
- awaiting approval runs,
- failed approval rejection runs,
- failed steps without retry policy.

## Runtime State

Extend controlled runtime types with audit metadata:

```ts
type ControlledRunAuditEvent = {
  id: string;
  type: "console_retry_requested";
  stepId?: string;
  message?: string;
  createdAt: number;
  actor: "local_user";
};
```

Add optional field:

```ts
auditEvents?: ControlledRunAuditEvent[];
```

The store must normalize missing `auditEvents` to `[]`.

When retry starts:

- append `console_retry_requested`,
- reset run state from `failed` to `running`,
- set `currentStepId` to the failed step,
- clear run-level `error`,
- clear failed step `error`,
- clear failed step `finishedAt`,
- keep previous `attempts` so attempt count remains auditable,
- keep previous tool results unless step-executor overwrites them during execution.

## Retry Execution

Add:

```ts
retryControlledExecutionRun(runId: string)
```

The function should mirror the safe parts of `resumeControlledExecutionRun`:

- build the request from the durable run,
- convert completed / skipped previous steps into initial results,
- pass `startStepIndex` for the failed step,
- preserve approved step ids,
- use `pauseOnApprovalRequired: true`,
- return `409` when retry is not allowed.

Expected result shape should include:

- `ok`,
- `status`,
- `error` when failed,
- `run`,
- `retriedStepIds`.

## Console Summary

Extend `ControlledRunConsoleSummary` with:

- `failedStepId?: string`
- `canRetry: boolean`
- `retryReason?: string`
- `auditEventCount: number`

Derive `canRetry` only when:

- run state is `failed`,
- first failed step exists,
- matching plan step declares `onFailure.action === "retry"`.

`retryReason` should explain why retry is unavailable, for example:

- `Run is not failed`
- `No failed step`
- `Failed step is not retryable`

## Runtime Console UI

In selected controlled run detail:

- show failed step id and retry reason when failed,
- show `重试失败步骤` only when `canRetry`,
- call the new retry route,
- disable action buttons while retry is in flight,
- refresh controlled runs after retry.

This should use the existing compact operational cockpit style. Do not redesign the console.

## API

Create:

```text
src/app/api/runtime/executor/controlled-runs/[runId]/retry/route.ts
```

Behavior:

- same local API auth boundary as resume route,
- `404` when run missing,
- `409` when retry not allowed,
- `200` with updated run and `retriedStepIds` when retry starts / completes.

## Testing

Add tests for:

- summary exposes failed step and retry eligibility.
- summary rejects non-retryable failed steps.
- retry route returns `404` for missing run.
- retry route returns `409` for non-retryable failed run.
- retry function retries a failed step with retry policy and records audit metadata.
- retry function does not replay completed prior steps.

## Success Criteria

- Operators can see whether a failed controlled run is retryable.
- Retry is only available when playbook policy allows it.
- Retry is persisted and auditable.
- Completed prior steps are not replayed.
- Full controlled runtime regression remains green.
