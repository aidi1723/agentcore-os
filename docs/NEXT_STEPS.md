# Next Steps

Last updated: 2026-07-06

This document is the execution backlog for the current `main` branch. It is narrower than the public roadmap and should be treated as the default work queue for engineering sessions.

## Current Direction

AgentCore OS is now centered on a **Controlled Skill / Playbook Runtime**.

The current goal is not to add more standalone apps. The goal is to make fixed playbooks reliable:

- fixed plan source,
- validated step schemas,
- restricted tools,
- durable approvals,
- resumable controlled runs,
- traceable execution,
- approved asset writeback,
- Runtime Console operation and recovery.

Read first:

- [Project Framework](PROJECT_FRAMEWORK.zh-CN.md)
- [Controlled Agent Runtime Development Manual](CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)

## Current Completed Baseline

Completed in the current controlled runtime line:

- `sales-pipeline-v1` fixed playbook.
- Playbook resolver and validator.
- Controlled output schema validation.
- Durable controlled run store.
- Durable approval records.
- Controlled run resume route.
- Client recovery after stream loss and approval races.
- Approved sales / knowledge asset writeback.
- Structured writeback receipts with `assetId`, `sourceKey`, and `workflowRunId`.
- Runtime Console trace landing.
- Runtime Console state filter and text search.
- Runtime Console approve / reject / resume.
- Runtime Console asset search and open actions.
- Runtime Console failed step retry eligibility.
- Runtime Console failed run recovery panel and `重试失败步骤` action.
- Durable audit events for console-initiated retry.
- Retry route for eligible failed controlled steps.
- Runtime Console record-level asset focus for Deal Desk and Knowledge Vault.
- Real server-backed `workflow_run` and `draft` controlled writeback targets.
- Runtime Console workflow run and draft deep links.
- `support-resolution-v1` fixed playbook for `support-ops`.
- Server-backed support asset writeback and support FAQ knowledge writeback.
- Runtime Console support asset landing summaries, search, and open action.

Current verification baseline:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Current `test:controlled-runtime` coverage:

- 21 test files.
- 127 tests.
- Includes sales/support playbook validation, controlled execution, approval/resume recovery, console summary metadata, retry route behavior, stream recovery, Runtime Console retry UI wiring, record-level asset focus, workflow/draft deep link coverage, and support asset writeback coverage.

Known current lint/build note:

- existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Completed. Runtime Console Failure Recovery

Why:

- Runtime Console can now approve, reject, resume, and open written assets.
- Failed controlled runs needed a precise recovery action instead of only an error state.
- Controlled runtime needs failure recovery to be explicit, tested, and auditable.

Delivered:

- `console-summary` derives failed step recovery metadata.
- Retry eligibility is gated by run state, failed step state, and playbook `onFailure.action === "retry"`.
- `POST /api/runtime/executor/controlled-runs/[runId]/retry` retries the first eligible failed step.
- Console-initiated retry appends durable audit metadata.
- Runtime Console shows failed step and recovery status for failed runs.
- Runtime Console shows `重试失败步骤` only when retry is allowed.
- Regression coverage covers retry safety, non-retryable failures, retry route behavior, and Runtime Console retry UI wiring.

Primary files:

- `src/lib/executor/runtime/console-summary.ts`
- `src/lib/executor/runtime/resume.ts`
- `src/lib/executor/runtime/types.ts`
- `src/lib/server/controlled-execution-store.ts`
- `src/app/api/runtime/executor/controlled-runs/[runId]/retry/route.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/__tests__/lib/executor/runtime/resume.test.ts`
- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- `src/__tests__/app/api/controlled-run-retry-route.test.ts`
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`

Outcome:

- Runtime Console shows why a controlled run failed.
- Operators can see whether the failed step is retryable.
- Retry actions are persisted and auditable.
- Non-retryable failures stay blocked instead of being replayed unsafely.

## Completed. Record-Level Asset Focus

Why:

- Runtime Console now opens Deal Desk / Knowledge Vault from asset landings.
- The previous open action passed workflow/query context, but did not focus the exact written record.
- Operators should be able to jump from trace to the exact business asset produced by the run.

Delivered:

- Cross-app prefill contracts now accept optional `assetId`, `sourceKey`, and workflow metadata.
- Sales and knowledge asset lookup helpers resolve exact retained records.
- Successful sales writeback receipts now include a stable `sourceKey`.
- Runtime Console forwards record focus metadata in successful asset landing open actions.
- Deal Desk selects the written sales asset's related existing deal instead of creating a duplicate lead.
- Knowledge Vault focuses and highlights the exact knowledge asset, including when the previous status filter would hide it.
- Old receipts without structured record metadata keep the broad app/context fallback only.
- Record-focus-only openings do not create synthetic Deal Desk leads; they wait for sales/knowledge asset hydration, retry focus, and report a missing-record error if the retained record is still unavailable.

Primary files:

- `src/lib/ui-events.ts`
- `src/components/apps/DealDeskAppWindow.tsx`
- `src/components/apps/KnowledgeVaultAppWindow.tsx`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/lib/sales-assets.ts`
- `src/lib/knowledge-assets.ts`
- `src/lib/executor/runtime/writeback.ts`
- `src/__tests__/lib/asset-record-focus.test.ts`
- `src/__tests__/components/DealDeskAppWindow.test.tsx`
- `src/__tests__/components/KnowledgeVaultAppWindow.test.tsx`

Outcome:

- A controlled run's asset landing opens the exact retained asset, not only the destination app.
- Operators can inspect what was written without manual search.

## Completed. Complete Skipped Writeback Targets

Why:

- `workflow_run` and `draft` writeback targets were explicit skipped receipts.
- Trace honesty was preserved, but the business loop was incomplete without real workflow/draft records.

Delivered:

- `workflow_run` writeback now upserts into the workflow run store through a stable `workflowRunId`.
- `draft` writeback now upserts into the draft store through `controlled-draft:{workflowRunId}`.
- Receipts include stable `sourceKey`, `workflowRunId`, and `assetId` for drafts.
- Final approved writeback now also updates workflow run state to `completed`.
- Approval-gated writeback remains blocked until approval.
- Repeat writeback / resume paths update existing workflow and draft records instead of creating duplicates.

Primary files:

- `src/lib/executor/runtime/writeback.ts`
- `src/lib/workflow-runs.ts`
- `src/lib/drafts.ts`
- `src/lib/server/workflow-run-store.ts`
- `src/lib/server/draft-store.ts`
- `src/__tests__/lib/executor/runtime/writeback.test.ts`
- `src/__tests__/lib/executor/runtime/resume.test.ts`
- `src/__tests__/lib/executor/controlled-runtime.test.ts`

Outcome:

- Controlled runs can update workflow and draft state with real receipts.
- The sales controlled runtime no longer reports unsupported skipped receipts for `workflow_run` or `draft`.
- `test:controlled-runtime` covers the workflow/draft stores and final writeback receipt shape.

## Completed. Runtime Console Workflow And Draft Deep Links

Why:

- The controlled runtime now writes workflow and draft records, but Runtime Console asset landings still focus on sales/knowledge assets.
- Operators should be able to inspect the workflow run and draft records that were written by the controlled trace without manual search.

Delivered:

- Controlled run summaries now include successful `workflow_run` and `draft` receipts in the asset landing panel.
- Workflow run landings open Industry Hub with `workflowRunId` and `scenarioId` focus prefill.
- Draft landings open Publisher with the written `draftId`, workflow run id, scenario id, source, and next-step context.
- Industry Hub listens for workflow focus prefill and selects the role/scenario that owns the matching run.
- Missing draft ids fail closed with a Runtime Console toast instead of opening an ambiguous Publisher context.

Primary files:

- `src/lib/executor/runtime/console-summary.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/lib/ui-events.ts`
- `src/components/apps/IndustryHubAppWindow.tsx`
- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- `src/__tests__/components/IndustryHubAppWindow.test.tsx`

Outcome:

- Runtime Console can open sales, knowledge, workflow, and draft writeback records from one trace.
- Operators no longer need to copy ids out of receipt text to find workflow/draft state.
- The trace landing panel remains one consistent surface for all current writeback targets.

## Completed. Support Playbook Migration

Why:

- Sales proves the controlled runtime path.
- Support is the next best scenario because it has clear intake, classification, draft, review, and assetization boundaries.

Delivered:

- Added `support-resolution-v1` playbook for `support-ops`.
- Defined fixed support steps: intake, classify, draft reply, human review, writeback.
- Added support step schemas, tool allowlists, approval gates, acceptance criteria, and writeback targets.
- Registered support playbook lookup by id and scenario.
- Added server-backed `support_asset` writeback, idempotent by `controlled-support-asset:{workflowRunId}`.
- Extended support knowledge writeback to produce `support_faq` assets.
- Reused workflow and draft writeback for support runs with support-specific stage/source metadata.
- Added Runtime Console support asset landing summaries, support asset search, and open action to Support Copilot.

Primary files:

- `src/lib/executor/playbooks/support-resolution.ts`
- `src/lib/executor/playbooks/catalog.ts`
- `src/lib/executor/runtime/writeback.ts`
- `src/lib/executor/runtime/console-summary.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/__tests__/lib/executor/playbooks/support-resolution.test.ts`
- `src/__tests__/lib/executor/runtime/writeback.test.ts`
- `src/__tests__/lib/executor/controlled-runtime.test.ts`
- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`

Outcome:

- Support workflow becomes the second controlled playbook.
- Runtime Console can compare multiple playbook families.
- Approved support runs write support assets, FAQ knowledge assets, drafts, and completed workflow runs.
- Support writeback is covered by `test:controlled-runtime`.

## P0. Support Runtime Console Record Focus

Why:

- Runtime Console can now expose and open support asset landings.
- The current open action passes workflow context to Support Copilot, but it does not yet focus the exact written support asset or related support ticket.
- This is the support equivalent of the Deal Desk / Knowledge Vault record-focus work.

Scope:

- Extend `SupportCopilotPrefill` with optional `assetId`, `sourceKey`, and focused workflow metadata if needed.
- Add support asset lookup helpers by `assetId`, `sourceKey`, and `workflowRunId`.
- Make Support Copilot focus the retained support asset when opened from Runtime Console.
- Preserve broad fallback behavior for legacy support receipts without structured metadata.
- Add hydration-race handling if the open event arrives before support assets hydrate from the server.

Primary files:

- `src/lib/support-assets.ts`
- `src/lib/ui-events.ts`
- `src/components/apps/SupportCopilotAppWindow.tsx`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/__tests__/components/SupportCopilotAppWindow.test.tsx`
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`

Expected outcome:

- A support controlled run's support asset landing opens the exact retained support asset, not only Support Copilot with workflow context.
- Missing exact support records fail visibly instead of creating duplicate local support records.

## P1. Trace Governance

Why:

- Trace is now a product capability, not a debug log.
- As more workflows enter controlled runtime, trace retention, redaction, export, and replay need explicit rules.

Scope:

- Define trace redaction rules.
- Define retention and export boundaries.
- Add trace-to-test fixture generation for selected runs.
- Add sensitive field classification for step input/output.

Primary files:

- `src/lib/executor/runtime/types.ts`
- `src/lib/server/controlled-execution-store.ts`
- `src/lib/executor/runtime/trace-redaction.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`

Expected outcome:

- Trace can support audit, debugging, and regression testing without leaking unnecessary sensitive data.

## Maintenance Rules

Default process:

1. Create or update a spec in `docs/superpowers/specs/`.
2. Create or update a plan in `docs/superpowers/plans/`.
3. Use TDD for runtime behavior.
4. Keep commits small by layer: docs, tests, runtime, UI, docs.
5. Update `CHANGELOG.md`, this file, and the development manual when the direction changes.

Default gates:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Docs-only gate:

```bash
git diff --check
```
