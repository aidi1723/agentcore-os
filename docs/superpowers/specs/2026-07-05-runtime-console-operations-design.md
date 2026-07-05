# Runtime Console Operations Design

## Goal

Let the Runtime Console operate on controlled runs after trace landing: filter runs, approve or reject pending approval steps, and resume interrupted or approved runs.

## Scope

In scope:

- Add summary-level operation signals for pending approval and resumable runs.
- Add filtering by run state and text query over run id, workflowRunId, playbookId, scenarioId, and title.
- Add Runtime Console controls for approve, reject, and resume.
- Refresh controlled runs after each operation.

Out of scope:

- Editing approval payloads beyond a short reject feedback.
- Automatic polling.
- Deep asset jump routing into CRM / Knowledge Vault records.
- Bulk operations.
- Redesigning Runtime Console layout.

## Existing Backends

Reuse existing APIs:

- `POST /api/agent/approve`
  - body: `{ executionId, stepId, approved, feedback? }`
- `POST /api/runtime/executor/controlled-runs/[runId]/resume`
  - resumes a non-terminal controlled run when allowed.

No new persistence layer is needed.

## Summary Model

Extend `buildControlledRunConsoleSummary(run)` with:

- `pendingApprovalStepId`
- `canApprove`
- `canResume`

Add:

```ts
filterControlledRunConsoleSummaries(summaries, filters)
```

Filters:

- `state`: `"all" | ControlledExecutionRunState`
- `query`: free text against id, workflowRunId, playbookId, scenarioId, title, currentStepId.

## UI Behavior

In `受控运行 Trace`:

- Add a state segmented control: all, running, awaiting, completed, failed.
- Add a compact text input for run / workflow / playbook search.
- In selected run detail:
  - show approve / reject buttons when `canApprove` is true,
  - show resume button when `canResume` is true,
  - disable buttons while an operation is in flight,
  - show toast result,
  - refresh the run list after operation.

## Error Handling

- Operation errors surface through the existing toast.
- Failed approval or resume does not mutate local state optimistically.
- Refresh failure keeps the existing list visible and shows the list error area.

## Testing

Add unit tests for:

- pending approval and resumable flags,
- filter by state,
- filter by text query.

Existing route and controlled runtime tests cover backend behavior.

## Success Criteria

- A pending controlled run can be approved or rejected from Runtime Console.
- An approved/interrupted controlled run can be resumed from Runtime Console.
- Runs can be filtered by state and searched by id/workflow/playbook text.
- Full verification passes.
