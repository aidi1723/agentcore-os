# Controlled Run Resume Design

## Goal

Close the durable controlled runtime loop by allowing an existing controlled execution run to resume after an approval pause, process interruption, or lost SSE connection.

The previous durable runtime slice made run state, step traces, approvals, schema validation, failure policy, and writeback receipts durable. This slice adds a small backend recovery path so the durable record can become operational state, not just an audit trail.

## Non-Goals

- No trace viewer UI in this slice.
- No background worker or automatic polling loop.
- No auto-resume inside `POST /api/agent/approve`.
- No new database dependency.
- No new playbooks.
- No generic DAG scheduler.

## API

Add:

```text
POST /api/runtime/executor/controlled-runs/[runId]/resume
```

The route returns JSON, not SSE:

```ts
type ResumeControlledRunResponse =
  | {
      ok: true;
      data: {
        runId: string;
        state: "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
        resumedStepIds: string[];
        run: ControlledExecutionRunRecord;
      };
    }
  | {
      ok: false;
      error: string;
      data?: {
        runId?: string;
        state?: ControlledExecutionRunState;
        currentStepId?: string;
      };
    };
```

The route uses the same local API authorization boundary as the existing controlled run query route.

## Resume Rules

The durable controlled run is the authority.

Allowed run states:

- `awaiting_approval`
- `running`

Rejected run states:

- `completed` returns `409`.
- `failed` returns `409`.
- `cancelled` returns `409`.
- missing run returns `404`.

Step rules:

- Completed and skipped steps are never re-executed.
- Failed steps are not retried by resume unless their own `onFailure` policy already allows retry inside the step executor.
- If the next executable step has a durable approval record with `state: "pending"`, resume returns `409` with `awaiting_approval`.
- If the current approval record is `approved`, resume may continue past that approval gate.
- If the current approval record is `rejected`, resume marks or preserves the run as `failed`.
- Resume stops when execution completes, fails, or reaches another approval gate.

## Runtime Boundary

Add a focused resume helper under executor runtime:

```text
src/lib/executor/runtime/resume.ts
```

Responsibilities:

- Load a durable run.
- Validate it is resumable.
- Build a request from the durable run record.
- Reconstruct prior completed step results from durable step records.
- Continue execution without repeating completed steps.
- Return the updated durable run and the list of step IDs executed during resume.

The existing `executeMultiStep` function currently starts from the first plan step. This slice should add a narrow continuation option rather than fork an entirely new executor:

```ts
type ExecuteMultiStepOptions = {
  initialStepResults?: StepResult[];
  startStepIndex?: number;
  skipApprovalForApprovedSteps?: boolean;
};
```

The default behavior remains unchanged for existing callers.

## Approval Handling

Resume must use durable approval records, not only in-memory waiters.

For a controlled review/manual step:

- If durable approval is `approved`, the executor does not wait again for that same step.
- If durable approval is `pending` or missing, resume pauses and returns `409`.
- If durable approval is `rejected`, resume returns `409` and the run remains failed.

This requires a small helper in the controlled execution store to inspect approval state by run/step, or direct use of the durable run record in the resume helper.

## Data Reconstruction

Resume reconstructs `StepResult[]` from durable completed/skipped steps:

- `stepId`
- `status`
- `output`
- `toolCallResults`
- `tokensUsed` defaults to `0` if not present.
- `durationMs` uses persisted timing if available, otherwise `0`.
- `error`

The reconstructed results provide dependency satisfaction and previous outputs for deterministic step input construction.

## Idempotency

Resume is safe to call repeatedly:

- Calling resume on a completed run returns `409 completed`.
- Calling resume while approval is still pending returns `409 awaiting_approval` without executing tools.
- Calling resume after approval executes only unfinished downstream steps.
- Calling resume again after downstream completion does not repeat writebacks or tools.

This is enforced by deriving the start position from durable step states every time.

## Testing

Add tests before implementation:

- Resume route returns `404` for missing run.
- Resume route returns `409` for completed/failed/cancelled runs.
- Pending approval does not execute downstream tools.
- Approved durable approval lets resume continue and complete downstream steps.
- Completed steps are not re-executed.
- The route returns updated durable run state and `resumedStepIds`.

Use temp cwd and `json-store.invalidateCache()` in tests to isolate durable files.

## Expected File Changes

Create:

- `src/lib/executor/runtime/resume.ts`
- `src/app/api/runtime/executor/controlled-runs/[runId]/resume/route.ts`
- `src/__tests__/lib/executor/runtime/resume.test.ts`
- `src/__tests__/app/api/controlled-run-resume-route.test.ts`

Modify:

- `src/lib/executor/step-executor.ts`
- `src/lib/executor/contracts.ts`
- `src/lib/server/controlled-execution-store.ts`
- `package.json`

## Success Criteria

- A run paused on durable approval can resume after approval is recorded.
- Resume never replays completed steps.
- Resume refuses terminal runs.
- Existing `/api/agent/stream` and `/api/agent/approve` behavior remains compatible.
- `npm run test:controlled-runtime`, `npm run test:core-workflows`, `npm run lint`, and `npm run build` pass.
