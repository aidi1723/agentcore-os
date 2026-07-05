# Controlled Run Asset Writeback Design

## Goal

Close the first controlled runtime business loop by writing approved `sales-pipeline-v1` outputs into server-backed sales and knowledge assets, then recording real writeback receipts in the controlled run trace.

The current runtime can resolve a fixed playbook, persist controlled runs, pause for durable approvals, resume safely, and recover client state. The remaining gap is that `src/lib/executor/runtime/writeback.ts` currently accepts configured writeback targets but does not write business assets.

## Non-Goals

- No new app windows.
- No visual redesign.
- No new persistence layer.
- No generic multi-playbook writeback framework in this slice.
- No automatic writeback for rejected or unapproved output.
- No broad migration of existing sales or knowledge assets.

## Current Baseline

`sales-pipeline-v1` declares these writeback targets:

- `qualify` writes to `sales_asset` on success.
- `draft_outreach` writes to `draft` on success.
- `human_review` writes to `workflow_run` after approval.
- `writeback` writes to `sales_asset` and `knowledge_asset` after approval.

The executor already stores `ControlledExecutionStepRecord.writebackReceipts`. The existing receipt builder returns optimistic `Accepted writeback target ...` summaries, but it does not call `src/lib/server/sales-asset-store.ts` or `src/lib/server/knowledge-asset-store.ts`.

## Program Review Findings

The controlled runtime is now strong enough for deterministic execution and recovery:

- fixed playbook source exists,
- plan validation exists,
- durable run and approval records exist,
- resume endpoint and client recovery exist,
- interrupted approval stream races are covered.

The main blocker for the next stage is output finality:

- completed controlled runs do not yet produce durable business assets,
- receipt summaries do not prove what changed,
- asset writeback is not idempotently tied to `workflowRunId` and controlled run identity,
- Runtime Console cannot yet show a meaningful asset landing path because the receipt is synthetic.

## Design

Add a server-safe writeback layer under `src/lib/executor/runtime/writeback.ts`.

The writeback function receives:

- controlled run context,
- playbook step definition,
- current `StepResult`,
- prior step results,
- whether the step was approved.

It returns `ControlledWritebackReceipt[]` and performs only the writes declared by the playbook step.

For this slice, implement real writes for:

- `sales_asset`
- `knowledge_asset`

Keep `workflow_run` and `draft` as explicit skipped receipts until their stores are wired in a later slice.

## Sales Asset Mapping

For `sales_asset`, use `upsertSalesAssetInStore` from `src/lib/server/sales-asset-store.ts`.

Idempotency:

- one sales asset per `workflowRunId` when available,
- otherwise one sales asset per controlled run id.

Field mapping should be conservative:

- `workflowRunId`: `run.workflowRunId ?? run.id`
- `scenarioId`: `run.scenarioId ?? "sales-pipeline"`
- `company`, `contactName`, `inquiryChannel`, `preferredLanguage`, `productLine`: from the latest `normalizedLead` found in prior outputs
- `requirementSummary`: from intake `summary`, lead `need`, or draft body fallback
- `preferenceNotes`: from qualification `reasons`
- `objectionNotes`: from qualification `risks`
- `nextAction`: from qualification `nextAction`
- `latestDraftSubject`: from draft output `subject`
- `latestDraftBody`: approved body first, draft body fallback
- `assetDraft`: approved body plus review notes when present
- `status`: `completed` for the final approved writeback step

## Knowledge Asset Mapping

For `knowledge_asset`, use `upsertKnowledgeAssetInStore` from `src/lib/server/knowledge-asset-store.ts`.

Idempotency:

- `sourceKey`: `controlled-run:${run.id}:knowledge_asset`

Field mapping:

- `title`: `Sales playbook asset - ${company || run.id}`
- `body`: approved body plus review notes and qualification rationale
- `sourceApp`: `personal_crm`
- `scenarioId`: `run.scenarioId ?? "sales-pipeline"`
- `workflowRunId`: `run.workflowRunId ?? run.id`
- `assetType`: `sales_playbook`
- `status`: `active`
- `tags`: `["controlled-run", "sales-pipeline", run.playbookId]`
- `applicableScene`: `sales-pipeline approved outreach and follow-up`

## Approval Rules

If a target uses `when: "after_approval"` and the step is not approved:

- do not write the asset,
- return `ok: false`,
- summary: `Skipped because output is not approved`.

If a step has no declared `writesTo`, return an empty receipt list.

## Receipt Rules

Receipts must distinguish:

- successful write,
- skipped unapproved write,
- unsupported target,
- failed write.

Each receipt should include:

- `target`,
- `ok`,
- `summary`,
- `writtenAt`.

The summary should mention the stored asset id or source key when available.

## Testing

Add focused tests for:

- approved final writeback creates/updates a sales asset,
- approved final writeback creates/updates a knowledge asset,
- repeated writeback is idempotent for the same workflow/run,
- unapproved after-approval targets are skipped,
- resume path records real writeback receipts after the final approved step.

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
npm test -- src/__tests__/lib/executor/runtime/resume.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

## Success Criteria

- A resumed and approved `sales-pipeline-v1` run writes a real sales asset.
- The same run writes a real knowledge asset.
- Receipts identify the concrete asset targets.
- Re-running resume for the same controlled run does not create duplicate assets.
- Rejected or unapproved outputs do not enter high-trust assets.
- Existing controlled runtime recovery tests continue to pass.
