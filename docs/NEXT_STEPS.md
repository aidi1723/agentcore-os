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
- Governed trace artifact builder and local trace artifact route.
- Runtime Console governed trace copy action and conservative terminal-run prune helper.
- Governed trace fixture builder, validator, and committed sales pipeline trace fixture.
- Pure trace fixture replay runner that checks committed governed fixtures against current controlled playbook contracts without executing tools or writing assets.
- Explicit governed trace fixture catalog with sales and support fixture replay coverage.
- Structured trace fixture drift diagnostics in replay reports, including expected/fixture step order, missing approval step ids, and missing writeback targets.
- Pure trace fixture catalog report helper that aggregates validation, replay, diagnostics, and no-side-effect guarantees for all committed fixtures.

Current verification baseline:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Current `test:controlled-runtime` coverage:

- 26 test files.
- 147 tests.
- Includes sales/support playbook validation, controlled execution, approval/resume recovery, console summary metadata, retry route behavior, stream recovery, Runtime Console retry UI wiring, record-level asset focus, workflow/draft deep link coverage, support asset writeback coverage, governed trace redaction, the local trace artifact route, Runtime Console governed trace copy, retention prune safety, governed trace fixture validation, pure trace fixture replay validation, catalog replay coverage for sales/support governed fixtures, and aggregate catalog report coverage.
- Trace fixture replay reports include structured drift diagnostics while preserving stable error messages.

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

## Completed. Trace Fixture Replay Runner

Why:

- Phase 10c made governed fixtures safe to commit, but fixtures did not yet prove compatibility with the live playbook catalog.
- Controlled playbook evolution needs deterministic failure when step order, approval gates, or writeback targets drift.

Delivered:

- Added `replayControlledTraceFixture()` in `src/lib/executor/runtime/trace-replay.ts`.
- Replay first runs `validateControlledTraceFixture()` and prefixes fixture safety failures.
- Replay checks that the fixture playbook is registered, fixture step order matches the current playbook, approval-gated steps include approval state, and each declared playbook writeback target appears on the same fixture step.
- Replay reports explicit non-execution guarantees: `toolCallsExecuted: false` and `assetsWritten: false`.
- Updated the committed sales governed fixture so it matches current `sales-pipeline-v1` approval/writeback expectations.
- Added mismatch coverage for step order drift, missing approval state, missing writeback target, and missing playbook.

Primary files:

- `src/lib/executor/runtime/trace-replay.ts`
- `src/__tests__/lib/executor/runtime/trace-replay.test.ts`
- `src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json`
- `package.json`

Outcome:

- Committed governed fixtures can now act as contract tests for controlled playbook changes.
- Replay remains pure: no LLM calls, no tool calls, no route calls, no store mutation, and no asset writes.
- `test:controlled-runtime` now covers trace fixture replay.

## Completed. Trace Fixture Catalog And Support Coverage

Why:

- The replay runner currently validates one committed sales fixture.
- The project now has two controlled playbooks, so support needs the same fixture/replay contract.
- A small fixture catalog will let future CI run all committed fixture replays without hardcoding each file in separate tests.

Delivered:

- Added a typed fixture catalog for committed governed trace fixtures.
- Added a committed governed `support-resolution-v1` fixture.
- Added a catalog replay test that validates every catalog fixture and runs `replayControlledTraceFixture()` for each entry.
- Kept the scope pure: no fixture generation route, no runtime store mutation, no tool replay.

Primary files:

- `src/__tests__/fixtures/controlled-traces/catalog.ts`
- `src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json`
- `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- `package.json`

Outcome:

- `test:controlled-runtime` validates every committed governed trace fixture through one catalog replay test.
- Sales and support playbook fixtures both fail deterministically if their current playbook contract drifts.

## Completed. Trace Fixture Drift Diagnostics

Why:

- Catalog replay now catches drift, but error output is still optimized for unit assertions rather than maintenance.
- Playbook edits should produce a compact diff-style report showing expected/current step order, missing approvals, and missing writeback targets.
- Better diagnostics will make fixture updates safer before any future real replay or fixture generation workflow.

Delivered:

- Added `diagnostics` to `ControlledTraceReplayReport`.
- Diagnostics include fixture id, playbook id, expected step order, fixture step order, missing approval step ids, and missing writeback targets.
- Existing `errors` strings remain stable for current assertions and downstream catalog replay.
- Added diagnostics coverage for success, step-order drift, missing approval state, missing writeback target, and unregistered playbooks.
- Kept scope pure: no LLM/tool replay, no routes, no stores, no asset writes.

Primary files:

- `src/lib/executor/runtime/trace-replay.ts`
- `src/__tests__/lib/executor/runtime/trace-replay.test.ts`

Outcome:

- Fixture drift failures are easy to interpret from one report object.
- Existing catalog replay coverage remains green.

## Completed. Trace Fixture Catalog Report

Why:

- Catalog replay now returns structured diagnostics per fixture, but there is not yet a reusable aggregate report for all committed fixtures.
- A pure catalog report would make CI and maintenance output easier to inspect without reading individual Vitest assertions.
- This should stay as metadata reporting only, before any future real tool replay.

Delivered:

- Added `buildControlledTraceFixtureCatalogReport()`.
- Report output includes aggregate counts, fixture ids, playbook ids, per-fixture validation, per-fixture replay reports, diagnostics, and no-side-effect guarantees.
- Added all-green committed catalog report coverage.
- Added synthetic drift coverage that keeps validation green while replay fails with structured diagnostics.
- Kept scope pure: no LLM calls, no tool calls, no route calls, no runtime store mutation, no asset writes, no API, and no CLI.

Primary files:

- `src/__tests__/fixtures/controlled-traces/catalog-report.ts`
- `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`

Outcome:

- One report object can explain the health of the entire committed governed fixture catalog.
- CI failures can point directly to the stale fixture and the exact drift diagnostics.

## Recommended Next. Trace Fixture Catalog CI Summary

Why:

- The catalog report helper now exists, but developers still need to run Vitest and inspect assertion failures.
- A small local script can print the aggregate report and exit non-zero on failed fixtures without adding runtime/API surface area.
- This should remain a maintenance tool over committed fixtures, not a route or UI feature.

Suggested scope:

- Add a local script that imports the catalog report helper and prints compact JSON.
- Add an npm script such as `test:trace-fixtures` or `trace:fixtures`.
- Exit non-zero when `report.ok` is false.
- Keep scope pure: no LLM calls, no tool calls, no route calls, no runtime store mutation, and no asset writes.

Completion target:

- A maintainer can run one focused command to inspect governed fixture catalog health.
- CI can surface the same aggregate report object when fixtures drift.

## Completed. Support Runtime Console Record Focus

Delivered:

- Extended `SupportCopilotPrefill` with optional `assetId` and `sourceKey`.
- Added support asset lookup helpers by `assetId`, `sourceKey`, and `workflowRunId` fallback.
- Runtime Console support asset landings now pass exact support receipt metadata into Support Copilot.
- Support Copilot focuses the existing related support ticket for exact support asset prefills.
- Broad support prefills without exact metadata still create a new ticket.
- Prefill-before-hydration requests stay pending and retry after support asset / ticket store updates.
- Missing exact support records show an error and do not create synthetic support tickets.

Primary files:

- `src/lib/support-assets.ts`
- `src/lib/ui-events.ts`
- `src/components/apps/SupportCopilotAppWindow.tsx`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/__tests__/components/SupportCopilotAppWindow.test.tsx`
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- `src/__tests__/lib/asset-record-focus.test.ts`

Outcome:

- A support controlled run's support asset landing now opens Support Copilot on the retained support asset's existing ticket.
- Missing exact support records fail visibly instead of duplicating local support records.

## Completed. Trace Governance Artifact Slice

Delivered:

- Added `src/lib/executor/runtime/trace-governance.ts`.
- Added a governed controlled-run trace artifact shape for fixture/export use.
- Redacted raw step input, step output, tool outputs, run errors, step errors, approval feedback, audit messages, plan goal, and step descriptions.
- Preserved operational metadata: run ids, playbook ids, scenario/workflow ids, step ids/states/timings, schema status, approval state/timing, writeback target metadata, and audit event type/actor/timing.
- Added local-only `GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact`.
- Left the existing durable controlled run store and Runtime Console list route unchanged.
- Added governance helper and route tests to `test:controlled-runtime`.

Primary files:

- `src/lib/executor/runtime/trace-governance.ts`
- `src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts`
- `src/__tests__/lib/executor/runtime/trace-governance.test.ts`
- `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts`
- `package.json`

Outcome:

- Controlled run trace now has a safe artifact boundary for future export and fixture generation.
- Runtime Console operations continue to use the full local run record without losing resume/retry behavior.

## Completed. Trace Governance Console Export And Retention

Delivered:

- Added export metadata to `GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact`.
- Runtime Console selected run detail now includes `Governed trace` and `复制脱敏 Trace`.
- Console export fetches the governed artifact route and copies `{ export, artifact }` JSON.
- Console export does not serialize the raw selected run record.
- Added `ControlledRunRetentionPolicy` and `pruneControlledExecutionRuns()` to the controlled execution store.
- Retention pruning removes only old terminal runs and keeps `running` / `awaiting_approval` runs.
- Retention pruning keeps at least `minTerminalRunsToKeep` terminal runs.

Primary files:

- `src/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/lib/server/controlled-execution-store.ts`
- `src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts`
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- `src/__tests__/lib/server/controlled-execution-store.test.ts`

Outcome:

- Operators can copy a governed trace artifact from Runtime Console without exposing raw step payloads.
- Raw controlled run cleanup now has a tested conservative helper.

## Completed. Trace Fixture Generation

Delivered:

- Added `src/lib/executor/runtime/trace-fixtures.ts`.
- Added `buildControlledTraceFixture()` on top of governed `ControlledTraceArtifact`.
- Added `validateControlledTraceFixture()` to check schema version, step order, redaction boundaries, tool output redaction, and known playbook order.
- Added committed sample fixture `src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json`.
- Added fixture tests to `test:controlled-runtime`.

Primary files:

- `src/lib/executor/runtime/trace-fixtures.ts`
- `src/__tests__/lib/executor/runtime/trace-fixtures.test.ts`
- `src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json`
- `package.json`

Outcome:

- Governed trace artifacts can now become stable regression fixtures without raw customer payloads.
- Fixture validation catches missing redaction boundaries before fixtures are reused.

## P0. Trace Fixture Replay Runner

Why:

- Governed trace artifacts can now become committed fixtures.
- The next reliability gain is a minimal runner that validates fixtures against current playbook contracts over time.

Scope:

- `src/lib/executor/runtime/trace-fixtures.ts`
- `src/lib/executor/runtime/trace-replay.ts`
- `src/__tests__/lib/executor/runtime/trace-replay.test.ts`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`

Expected outcome:

- Committed trace fixtures can be replay-validated against current playbook step order, approval boundaries, and writeback expectations without calling real tools.

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
