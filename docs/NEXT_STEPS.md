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

Current verification baseline:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Current `test:controlled-runtime` coverage:

- 20 test files.
- 115 tests.
- Includes playbook validation, controlled execution, approval/resume recovery, console summary metadata, retry route behavior, stream recovery, Runtime Console retry UI wiring, and record-level asset focus coverage.

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
- Preserve fallback behavior for old receipts without structured metadata.

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

## P0. Complete Skipped Writeback Targets

Why:

- `workflow_run` and `draft` writeback targets are currently explicit skipped receipts.
- This is acceptable for trace honesty, but the business loop is incomplete.

Scope:

- Implement real writeback for `workflow_run`.
- Implement real writeback for `draft`.
- Keep writeback idempotent by controlled run id / workflow run id / source key.
- Keep unapproved output out of durable business assets.

Primary files:

- `src/lib/executor/runtime/writeback.ts`
- `src/lib/workflow-runs.ts`
- `src/lib/drafts.ts`
- `src/lib/server/workflow-run-store.ts`
- `src/lib/server/draft-store.ts`
- `src/__tests__/lib/executor/runtime/writeback.test.ts`
- `src/__tests__/lib/executor/runtime/resume.test.ts`

Expected outcome:

- Controlled runs can update workflow and draft state with real receipts.
- Unsupported writeback target count is reduced.

## P1. Support Playbook Migration

Why:

- Sales proves the controlled runtime path.
- Support is the next best scenario because it has clear intake, classification, draft, review, and assetization boundaries.

Scope:

- Add `support-resolution-v1` playbook.
- Add resolver / validator support.
- Define step schemas for intake, classify, draft reply, human review, writeback.
- Wire support asset / knowledge asset writeback.
- Add Runtime Console trace display support without special UI branches.

Primary files:

- `src/lib/executor/playbooks/support-resolution.ts`
- `src/lib/executor/playbooks/catalog.ts`
- `src/lib/executor/playbooks/resolver.ts`
- `src/lib/executor/runtime/writeback.ts`
- `src/components/apps/SupportCopilotAppWindow.tsx`
- `src/lib/support-assets.ts`
- `src/__tests__/lib/executor/playbooks/support-resolution.test.ts`
- `src/__tests__/lib/executor/controlled-runtime.test.ts`

Expected outcome:

- Support workflow becomes the second controlled playbook.
- Runtime Console can compare multiple playbook families.

## P2. Trace Governance

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
