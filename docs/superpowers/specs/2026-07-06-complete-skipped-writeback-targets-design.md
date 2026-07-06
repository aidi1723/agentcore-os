# Complete Skipped Writeback Targets Design

## Goal

Convert the remaining skipped controlled writeback targets, `workflow_run` and `draft`, into real server-backed writes while preserving deterministic traces, approval boundaries, and idempotency.

## Scope

In scope:

- Write `workflow_run` receipts to the existing server-backed workflow run store.
- Write `draft` receipts to the existing server-backed draft store.
- Keep writes idempotent by controlled run / workflow run stable ids.
- Return concrete writeback receipts with stable `sourceKey`, `workflowRunId`, and `assetId` where applicable.
- Update controlled runtime tests, changelog, next steps, and the controlled runtime manual.

Out of scope:

- New Runtime Console open actions for workflow runs or drafts.
- New app UI, routing, or asset detail pages.
- General-purpose writeback target registry.
- Historical receipt migration.
- Support playbook writeback expansion.
- New packages or external services.

## Current Behavior

`writeControlledStepAssets` currently writes:

- `sales_asset` to `sales-assets.json`,
- `knowledge_asset` to `knowledge-assets.json`.

For `workflow_run` and `draft`, it returns explicit skipped receipts:

```txt
Skipped unsupported writeback target workflow_run
Skipped unsupported writeback target draft
```

This keeps traces honest, but the controlled run does not complete the workflow/draft side of the business loop.

## Design

### Workflow Run Writeback

Use `upsertWorkflowRunInStore` from `src/lib/server/workflow-run-store.ts`.

The record id must be stable:

```ts
const workflowRunId = run.workflowRunId?.trim() || run.id;
```

The record should represent the controlled playbook's current business workflow state:

- `id`: stable `workflowRunId`.
- `scenarioId`: `run.scenarioId || "sales-pipeline"`.
- `scenarioTitle`: from the controlled playbook title, falling back to `run.playbookId`.
- `triggerType`: `"manual"` for executor-originated controlled writeback.
- `stageRuns`: derived from `run.plan.steps`.
- `currentStageId`: current step id unless the controlled run is completed.
- `state`:
  - `completed` when the current writeback step is `writeback` and approved,
  - `awaiting_human` when the current step is approval-oriented,
  - otherwise `running`.
- `createdAt`: keep the existing store record's `createdAt` if present is not required for this slice; use `run.createdAt`.
- `updatedAt`: writeback time.

Stage state derivation:

- Steps before and including the written step are `completed` when the step result is completed.
- The next step is `awaiting_human` if its mode is `review` or `manual`, otherwise `running`.
- Future steps are `pending`.
- Final approved `writeback` marks all stages `completed`.

Receipt:

```ts
{
  target: "workflow_run",
  ok: true,
  summary: `Wrote workflow run ${stored.id} as ${stored.state}`,
  writtenAt,
  sourceKey: `controlled-run:${run.id}:workflow_run`,
  workflowRunId: stored.id,
}
```

### Draft Writeback

Use `upsertDraftInStore` from `src/lib/server/draft-store.ts`.

The draft id must be stable:

```ts
const draftId = `controlled-draft:${workflowRunId}`;
```

The draft should be built from the `draft_outreach` step output:

- `title`: `subject` or `Sales outreach draft - {company || workflowRunId}`.
- `body`: `body`.
- `tags`: `["controlled-run", "sales-pipeline", run.playbookId]`.
- `source`: `"publisher"`.
- `workflowRunId`: stable workflow run id.
- `workflowScenarioId`: `run.scenarioId || "sales-pipeline"`.
- `workflowStageId`: `"draft_outreach"`.
- `workflowSource`: `Controlled run {run.id}`.
- `workflowNextStep`: `"Review and approve the controlled outreach draft."`.
- `workflowTriggerType`: `"manual"`.
- `workflowOriginApp`: `"publisher"`.
- `workflowOriginId`: `run.id`.
- `workflowOriginLabel`: `run.playbookId`.
- `workflowAudience`: company/contact summary if available.
- `workflowPrimaryAngle`: qualification next action if available.
- `workflowSourceSummary`: intake summary if available.
- `workflowBlockLabel`: `"Controlled Runtime"`.
- `workflowPublishNotes`: assumptions and human-check needs joined as short notes.
- `createdAt`: `run.createdAt`.
- `updatedAt`: writeback time.

Receipt:

```ts
{
  target: "draft",
  ok: true,
  summary: `Wrote draft ${stored.id}`,
  writtenAt,
  assetId: stored.id,
  sourceKey: `controlled-run:${run.id}:draft`,
  workflowRunId: stored.workflowRunId,
}
```

### Approval Boundary

Existing approval handling stays authoritative:

- `when: "after_approval"` writes remain skipped when `approved` is false.
- `draft_outreach` is `on_success`, so it can write a draft before human approval.
- Final sales/knowledge asset writes remain `after_approval`.

### Idempotency

Idempotency is store-level and id-level:

- `workflow_run`: stable id is `workflowRunId || run.id`.
- `draft`: stable id is `controlled-draft:{workflowRunId}`.
- Re-running or resuming the same controlled run updates the same records instead of creating duplicates.

### Error Handling

If a store rejects or fails to normalize a record:

- return `ok: false`,
- use a concise summary such as `Failed to write workflow run`,
- do not throw out of the entire writeback loop,
- continue writing other targets.

## Testing

Add or update tests in `src/__tests__/lib/executor/runtime/writeback.test.ts`:

- `workflow_run` target writes a real workflow run record for `intake`.
- `draft` target writes a real draft record for `draft_outreach`.
- Repeating the same writeback is idempotent for workflow run and draft.
- Existing unapproved `after_approval` skip behavior remains unchanged.
- Final approved writeback still writes sales/knowledge assets.

Update controlled runtime integration expectations currently asserting skipped `workflow_run` / `draft`.

Verification gates:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

## Success Criteria

- `workflow_run` and `draft` no longer produce unsupported skipped receipts in the sales pipeline controlled run.
- Workflow run and draft stores contain real records after successful controlled steps.
- Repeat writeback / resume paths do not create duplicate workflow runs or drafts.
- Approval-gated writebacks remain blocked until approval.
- Runtime Console continues to display writeback receipts without requiring UI changes.
- Full verification passes with only the existing `<img>` lint/build warning.
