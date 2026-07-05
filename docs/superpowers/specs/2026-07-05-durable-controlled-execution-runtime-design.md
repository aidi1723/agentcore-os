# Durable Controlled Execution Runtime Design

## Goal

Turn the current controlled playbook runner into a durable, auditable runtime that can pause, recover, validate step outputs, and persist execution traces without expanding the desktop shell or adding new apps.

## Current Baseline

The project already has the first controlled runtime slice:

- `src/lib/executor/playbooks/*` defines and validates a fixed `sales-pipeline-v1` playbook.
- `src/lib/executor/core.ts` rejects invalid supplied controlled plans before execution.
- `src/lib/executor/step-executor.ts` enforces approval for controlled review/manual steps.
- `/api/agent/stream` resolves controlled playbooks and streams execution events.
- `runWorkflowMultiStep` and `useMultiStepStream` now treat `execution_done.ok !== true` as failure.

The remaining gap is durability and data semantics. Multi-step controlled execution still depends on an in-memory approval store, does not persist step-by-step trace records, does not validate tool outputs against playbook output schemas, and does not apply `writesTo` / `onFailure` semantics.

## Non-Goals

- Do not add new standalone desktop apps.
- Do not redesign the shell, window manager, or visual system.
- Do not introduce a new database dependency in this slice.
- Do not build a generic plugin marketplace.
- Do not add more playbooks until the runtime contract is durable.
- Do not let LLM planning become the authority for controlled workflows.

## Architecture

The controlled runtime should become a small set of explicit modules under `src/lib/executor/runtime/*`:

```text
Controlled request
  -> Playbook resolution and validation
  -> Durable execution run creation
  -> Step execution state machine
  -> Tool execution and output capture
  -> Output schema validation
  -> Durable approval pause / resume
  -> Failure policy handling
  -> Trace persistence
  -> Optional asset writeback
```

The immediate storage backend should use the existing file-backed server JSON pattern through `src/lib/server/json-store.ts`. This keeps the slice aligned with `executor-session-store`, `executor-audit-store`, `workflow-run-store`, and other current durable state modules.

## Runtime Records

Create a durable execution record type that is separate from UI workflow runs.

```ts
export type ControlledExecutionRunState =
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type ControlledExecutionStepState =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export type ControlledExecutionRunRecord = {
  id: string;
  requestId: string;
  sessionId: string;
  workflowRunId?: string;
  scenarioId?: string;
  playbookId: string;
  playbookVersion: string;
  planId: string;
  state: ControlledExecutionRunState;
  currentStepId?: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  error?: string;
  plan: ExecutionPlan;
  steps: ControlledExecutionStepRecord[];
};

export type ControlledExecutionStepRecord = {
  stepId: string;
  state: ControlledExecutionStepState;
  startedAt?: number;
  finishedAt?: number;
  input: unknown;
  output: unknown;
  error?: string;
  toolCallResults: ToolCallResult[];
  approval?: ControlledApprovalRecord;
  schemaValidation?: ControlledSchemaValidationRecord;
};
```

The durable run record is the source of truth for multi-step controlled execution. `workflow-runs.ts` can still drive product workflow state, but it should not be the only execution trace.

## Approval Model

Replace the in-memory-only approval boundary with a durable pending approval record:

```ts
export type ControlledApprovalRecord = {
  executionId: string;
  stepId: string;
  state: "pending" | "approved" | "rejected" | "timed_out";
  requestedAt: number;
  resolvedAt?: number;
  feedback?: string;
  approver?: "local_user";
};
```

The runtime may keep an in-memory resolver map for an active SSE request, but that map must be treated as an optimization only. The durable record is authoritative.

Required behavior:

- When a controlled review/manual step needs approval, persist `state: "pending"` before emitting `approval_needed`.
- `POST /api/agent/approve` updates the durable record first, then resolves an active in-memory waiter if present.
- If the SSE connection is gone, approval should still be recorded and the execution should be resumable through a later runtime call.
- Approval rejection must mark the step and run as failed unless the playbook step declares `onFailure.action === "await_human"` and the runtime explicitly supports a revision loop.

## Step Input And Output Semantics

Each step should receive structured input from:

- original request message and workspace context,
- previous completed step outputs,
- workflow run metadata,
- playbook step metadata.

The runtime should build a deterministic `stepInput` object before each tool call and persist it in the step trace. Tool calls should not infer context only from `step.description`.

After a tool call succeeds, the runtime should validate the step output against `ControlledPlaybookStep.outputSchema`.

Required behavior:

- Missing required fields fail the step.
- Wrong primitive types fail the step.
- Schema validation errors are recorded in `schemaValidation`.
- A schema failure must not be treated as successful completion.
- The terminal `execution_done.error` should contain the schema failure summary.

This slice can implement a small local validator for the subset already used by the playbook schemas: `type`, `required`, `properties`, `items`, `enum`, and `additionalProperties`.

## Failure Policy

The existing playbook field `onFailure` should become runtime behavior:

- `fail_run`: mark the step and run failed immediately.
- `await_human`: mark the run `awaiting_approval` or `failed` with a clear human-action reason, depending on whether a revision approval path exists for the step.
- `retry`: retry the step up to `maxRetries`, recording every failed attempt.

The first implementation should support:

- `fail_run`
- bounded `retry`
- `await_human` as a paused state with durable trace, not silent success

The runtime should not continue to downstream dependent steps after a failed step unless the playbook explicitly defines a recovery path.

## Trace Store

Add a controlled execution trace store under `src/lib/server/controlled-execution-store.ts`.

Responsibilities:

- create run records,
- update step state,
- append tool results,
- store approval decisions,
- store schema validation results,
- complete/fail/cancel runs,
- query by `requestId`, `sessionId`, `workflowRunId`, and `playbookId`.

This store should redact sensitive text using `redactSensitiveText` before writing previews or error summaries, following the pattern in executor audit/session stores.

## Streaming Contract

The SSE stream should become a projection of durable state, not the only state carrier.

Existing events can remain:

- `plan_ready`
- `step_start`
- `step_progress`
- `step_complete`
- `approval_needed`
- `error`
- `execution_done`

Add stable fields to events:

- `executionId`
- `requestId`
- `playbookId`
- `workflowRunId`
- `stepId`
- `runState`

Required behavior:

- `execution_done` is mandatory for a successful stream.
- `execution_done.ok === true` is the only success terminal signal.
- Failed terminal events must include `error`.
- UI consumers should tolerate duplicate non-terminal `error` and failed terminal events without double-failing product workflow state.

## Asset Writeback

The current playbook already declares `writesTo`, but the runtime does not apply it.

Add a small writeback adapter layer:

```text
src/lib/executor/runtime/writeback.ts
```

Responsibilities:

- map `workflow_run`, `draft`, `sales_asset`, `support_asset`, `knowledge_asset` to existing domain store APIs,
- require approval for `when: "after_approval"`,
- write only validated outputs,
- write only approved outputs for high-trust assets,
- record writeback receipts in the step trace.

The first implementation should only wire the sales pipeline targets that already exist in the project. Unsupported targets should fail loudly during playbook validation or runtime startup, not silently no-op.

## API Boundaries

Keep the current public API shape, but route controlled runtime through durable state:

- `/api/agent/stream`
  - create or resume a controlled execution run,
  - stream durable state changes,
  - reject invalid playbooks before run creation.
- `/api/agent/approve`
  - update durable approval state,
  - resolve active waiter if present.
- New runtime query route:
  - `GET /api/runtime/executor/controlled-runs/:runId`
  - returns the durable controlled run record.

The new query route is for debugging, trace viewing, and future UI recovery.

## Testing Strategy

Add tests before implementation for each runtime boundary:

- Store tests:
  - create run,
  - update step state,
  - persist pending approval,
  - resolve approval after simulated restart,
  - fail run with error.
- Runtime tests:
  - schema-invalid step output fails execution,
  - rejected approval persists `trace.error`,
  - retry policy records multiple attempts,
  - dependent steps do not run after failure,
  - run can be resumed after approval is recorded.
- API tests:
  - `/api/agent/stream` creates a durable controlled run,
  - `/api/agent/approve` updates durable approval state,
  - query route returns controlled run trace.
- Regression gate:
  - extend `npm run test:controlled-runtime` with the new store/runtime/API tests.

Keep the existing `npm run test:core-workflows`, `npm run lint`, and `npm run build` as final verification gates.

## Rollout Plan

Implement in four slices:

1. **Durable Run And Approval Store**
   - Add controlled execution store.
   - Replace approval-store authority with durable approval records.
   - Keep current SSE behavior compatible.

2. **Step Data And Schema Validation**
   - Build deterministic step input.
   - Validate step outputs.
   - Persist schema failures.

3. **Failure Policy And Resume**
   - Apply `onFailure`.
   - Support resume after approval.
   - Prevent dependent steps from running after failed unrecovered steps.

4. **Writeback Receipts**
   - Implement minimal sales pipeline writeback.
   - Persist writeback receipts.
   - Fail unsupported write targets explicitly.

## Success Criteria

The runtime is considered ready for the next playbook only when:

- a controlled execution can be inspected after stream completion,
- a pending approval survives stream disconnect,
- a failed step records the exact failure reason,
- invalid structured output fails before writeback,
- approved output can write to the intended asset store,
- `npm run test:controlled-runtime`, `npm run test:core-workflows`, `npm run lint`, and `npm run build` pass.
