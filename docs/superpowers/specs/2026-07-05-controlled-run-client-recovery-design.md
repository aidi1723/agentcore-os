# Controlled Run Client Recovery Design

## Goal

Close the user-facing controlled runtime loop by letting the existing multi-step client continue a durable controlled run after approval, stream loss, or a recoverable paused state.

The backend now has a durable resume endpoint:

```text
POST /api/runtime/executor/controlled-runs/[runId]/resume
```

This slice wires that route into the client execution surface without adding a new trace viewer, background worker, or broad UI redesign.

## Non-Goals

- No controlled run list in this slice.
- No full trace viewer.
- No automatic background polling.
- No resume from arbitrary historical runs unless the client already knows the run id.
- No changes to playbook semantics.
- No new persistence layer.
- No large visual redesign of the shell or sidebar.

## Current Baseline

`useMultiStepStream` starts `/api/agent/stream`, tracks `executionId`, renders streamed plan and step results, and posts approval decisions to `/api/agent/approve`.

The current gap is that approval does not continue a durable run when the active SSE request has already paused or disconnected. The hook sets the UI back to `running`, but it does not call the durable resume route. A user can approve a step and still have no reliable client path for downstream execution.

## User Experience

The multi-step panel remains a compact operational runtime surface. It should show a recovery action only when there is something recoverable:

- approval is approved and the run needs to continue,
- the stream ended or errored after a run id was issued,
- the run is still awaiting another approval after a resume attempt.

The panel should keep existing information architecture:

- status badge,
- plan progress,
- approval card,
- error text,
- stop action.

Add one restrained secondary action:

```text
继续执行
```

This action appears only when the hook has an `executionId` and the current status is `awaiting_approval` or `error`. It calls the same client resume function used after approval.

The design follows `DESIGN.md`: stable workflow progress, clear recovery state, restrained operational styling, and no decorative redesign.

## Client Hook Design

Extend `useMultiStepStream` with a first-class resume function:

```ts
resume(runId?: string): Promise<void>
```

Behavior:

- If `runId` is omitted, resume uses the current `executionId`.
- If no run id is available, it sets `status: "error"` with a clear message.
- It calls `POST /api/runtime/executor/controlled-runs/${runId}/resume`.
- It handles both `ok: true` and `ok: false` JSON responses.
- It updates plan, current step, completed step results, approval request, status, and error from the returned durable run.

Add a transient client status:

```ts
type MultiStepStatus =
  | "idle"
  | "connecting"
  | "running"
  | "resuming"
  | "awaiting_approval"
  | "done"
  | "error";
```

`resuming` is client-only and prevents ambiguous UI while the resume request is in flight.

## Durable Run Projection

Add a small projection helper in the hook file or a nearby client-safe module. It converts the durable run returned by the resume route into hook state.

Projection rules:

- `run.id` becomes `executionId`.
- `run.plan` becomes `plan`.
- `run.currentStepId` becomes `currentStepId`.
- Durable `completed` and `skipped` steps become `StepResult[]`.
- Durable `failed` steps become failed `StepResult[]`.
- A step with `state: "awaiting_approval"` and pending approval becomes `approvalRequest`.
- `run.state: "completed"` maps to `status: "done"`.
- `run.state: "failed"` or `cancelled` maps to `status: "error"`.
- `run.state: "awaiting_approval"` maps to `status: "awaiting_approval"`.
- `run.state: "running"` maps to `status: "running"` only if the resume request completed successfully and no new approval is pending.

The projection should not invent step outputs. Missing durable output remains `null`.

## Approval Flow

Update `approve(approved, feedback?)`:

- Post the approval decision as it does today.
- If the approval route returns non-2xx, set `error`.
- If `approved === false`, set `status: "error"` and preserve the rejection feedback.
- If `approved === true`, clear the approval request and call `resume(executionId)`.

This keeps the human decision explicit while making approval operationally useful.

## Resume Response Handling

For successful resume responses:

```ts
{
  ok: true,
  data: {
    runId,
    state,
    resumedStepIds,
    run
  }
}
```

The client projects `data.run` into hook state. `resumedStepIds` may be kept for later display, but this slice does not need a new visible counter.

For conflict responses:

```ts
{
  ok: false,
  error,
  data: {
    runId,
    state,
    currentStepId
  }
}
```

Handling:

- `state: "awaiting_approval"` keeps the panel in `awaiting_approval` and shows the error only if no approval request can be reconstructed.
- `state: "completed"` maps to `done`.
- `state: "failed"` or `cancelled` maps to `error`.
- Missing run maps to `error`.

The client should not retry automatically.

## Component Design

`MultiStepPanel` receives the new hook fields:

- `resume`
- `canResume`

`canResume` is true when:

- `executionId` exists,
- status is `error`, or status is `awaiting_approval` without an active `approvalRequest`,
- status is not `resuming`.

The panel adds:

- status badge label for `resuming`: `恢复中`
- a compact `继续执行` secondary button for recoverable states

No other layout changes are needed.

## Error Handling

The hook must preserve precise terminal errors:

- failed `execution_done` remains `error`,
- stream ending before `execution_done` remains `error`,
- failed approval POST becomes `Approval failed: HTTP <status>`,
- failed resume POST uses the route error when available,
- failed JSON parse becomes a generic resume failure.

The hook should avoid claiming success when resume returns `409`.

## Testing

Add hook tests before implementation:

- approving a pending request calls `/api/agent/approve`, then calls the resume route.
- successful resume projects durable completed steps into `stepResults`.
- resume conflict with `awaiting_approval` keeps the hook awaiting approval.
- resume without an execution id returns an error state.
- approval rejection does not call resume and becomes error.
- manual `resume()` after stream error calls the resume route.

Add component tests only if the existing test setup already covers `MultiStepPanel` ergonomically. If not, keep this slice at hook-level plus type coverage to avoid brittle visual tests.

## Expected File Changes

Modify:

- `src/hooks/useMultiStepStream.ts`
- `src/components/MultiStepPanel.tsx`
- `src/__tests__/hooks/useMultiStepStream.test.tsx`

No backend route changes are expected.

## Success Criteria

- A user approval can continue a durable controlled run through the resume endpoint.
- A lost or failed stream with a known run id can be manually resumed from the panel.
- The hook never reports success for a conflicted or failed resume.
- Existing stream success and failure behavior remains compatible.
- `npm test -- src/__tests__/hooks/useMultiStepStream.test.tsx`, `npm run test:controlled-runtime`, `npm run lint`, and `npm run build` pass.
