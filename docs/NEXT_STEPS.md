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
- `npm run trace:fixtures` local CI summary command for governed fixture catalog health.
- `npm run trace:fixture:build -- <artifact.json>` local builder command for converting governed trace artifact files into validated fixture JSON.
- Governed trace fixture refresh workflow guide for manual fixture replacement and review.
- Deeper fixture replay golden invariants for playbook version, scenario, plan metadata, completed attempts, approval terminal state, and stable writeback identity metadata.
- Governed trace fixture replay contract guide for replay invariant interpretation, diagnostics reference, and maintainer failure triage.
- Human-readable governed trace fixture replay summary command.
- Synthetic validation/replay failure fixtures, failure exit harness coverage, and a replay contract failure fixture matrix mapping failures to source factories/tests and maintainer actions.
- Governed fixture refresh review checklist for candidate fixture replacement decisions.
- Governed trace fixture CI gate guide for local, fixture-refresh, and CI-style command usage.
- Governed trace fixture catalog coverage guide for committed fixture expansion decisions.
- Governed trace operational runbook for artifact export, fixture refresh, replay gates, retention, and real replay boundaries.
- Replay sandbox contract types, no-side-effect replay sandbox prototype, fixture-to-contract bridge, and catalog-level replay sandbox report for committed governed fixtures.

Current verification baseline:

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Current `test:controlled-runtime` coverage:

- 34 test files.
- 181 tests.
- Includes sales/support playbook validation, controlled execution, approval/resume recovery, console summary metadata, retry route behavior, stream recovery, Runtime Console retry UI wiring, record-level asset focus, workflow/draft deep link coverage, support asset writeback coverage, governed trace redaction, the local trace artifact route, Runtime Console governed trace copy, retention prune safety, governed trace fixture validation, pure trace fixture replay validation, replay sandbox contracts, no-side-effect replay sandbox prototype, fixture-to-contract bridge coverage, replay sandbox catalog report coverage, replay sandbox catalog CI summary coverage, catalog replay coverage for sales/support governed fixtures, aggregate catalog report coverage, trace fixture catalog CI summary command coverage, and governed trace fixture builder CLI coverage.
- Trace fixture replay reports include structured drift diagnostics, deeper golden invariant diagnostics, validation failure diagnostics, human-readable summary output, and failure harness coverage while preserving stable error messages.

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

## Completed. Trace Fixture Catalog CI Summary

Why:

- The catalog report helper now exists, but developers still need to run Vitest and inspect assertion failures.
- A small local script can print the aggregate report and exit non-zero on failed fixtures without adding runtime/API surface area.
- This should remain a maintenance tool over committed fixtures, not a route or UI feature.

Delivered:

- Added `scripts/trace-fixtures/catalog-report.mjs`.
- Added `npm run trace:fixtures`.
- The command prints compact parseable JSON and exits non-zero when `report.ok` is false.
- The output includes aggregate counts, fixture ids, playbook ids, failed item validation/replay diagnostics, and no-side-effect guarantees.
- Added a subprocess test and included it in `test:controlled-runtime`.
- Kept scope pure: no LLM calls, no tool calls, no route calls, no runtime store mutation, and no asset writes.

Primary files:

- `scripts/trace-fixtures/catalog-report.mjs`
- `src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts`
- `package.json`

Outcome:

- A maintainer can run one focused command to inspect governed fixture catalog health.
- CI can surface the same aggregate report object when fixtures drift.

## Completed. Fixture Replay Failure Documentation Matrix

Why:

- Validation failures, replay drift failures, and failure harness coverage were implemented across several test files.
- Maintainers needed one contract-level matrix that maps each failure class to the synthetic factory, diagnostic, regression owner, and action.
- The matrix should keep synthetic failures clearly outside the committed governed fixture catalog.

Delivered:

- Added `Failure Fixture Matrix` to the governed trace fixture replay contract guide.
- Mapped missing `sourceRunId`, unredacted step input, unredacted tool output, playbook version drift, missing stable writeback metadata, combined summary failures, and the process exit harness to concrete files.
- Clarified that synthetic failures are test-only sources for proving diagnostics and exit behavior.

Primary files:

- `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`
- `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`
- `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts`
- `scripts/trace-fixtures/catalog-failure-harness.mjs`

Outcome:

- Fixture replay failure triage can start from the contract guide instead of test-source archaeology.
- Maintainers can decide whether to reject a candidate, fix governed artifact redaction, confirm playbook drift, or inspect harness behavior before refreshing fixtures.

## Completed. Fixture Replay Refresh Review Checklist

Why:

- Fixture refresh had a builder command, replay contract, failure matrix, and committed catalog health checks.
- The remaining maintainer risk was inconsistent candidate fixture review before replacing committed fixture JSON.
- The refresh workflow needed a repeatable pass/fail gate without adding automatic fixture writes.

Delivered:

- Added candidate fixture review gates to the governed trace fixture refresh workflow.
- Split review into source identity, redaction, playbook contract, approval and terminal state, writeback identity, failure triage, sensitive search, and replacement diff checks.
- Cross-linked failure triage to the replay contract failure fixture matrix.
- Kept replacement manual and reviewable: no auto-write command, no runtime/API/UI changes, no fixture discovery, no tool replay, no store mutation, and no asset writes.

Primary files:

- `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- `docs/superpowers/plans/2026-07-06-fixture-replay-refresh-review-checklist.md`

Outcome:

- Maintainers now have a single checklist from candidate fixture generation to replacement decision.
- Unsafe candidates are rejected at the source instead of being hand-edited into committed fixture JSON.

## Completed. Fixture Replay CI Gate Documentation

Why:

- Fixture replay had JSON and human-readable health commands plus a manual refresh checklist.
- Maintainers still needed one place to decide which command belongs in local, fixture-refresh, and CI-style gates.
- The project needed to keep the stable automation contract separate from human-readable summary output.

Delivered:

- Added `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`.
- Documented `trace:fixtures` as the stable JSON automation command.
- Documented `trace:fixtures:summary` as local human triage over the same report, not a parseable automation contract.
- Documented `trace:fixture:build` as a manual refresh-workflow command only.
- Linked the gate guide from the replay contract, refresh workflow, and documentation index.

Primary files:

- `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
- `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- `docs/DOCUMENTATION_INDEX.zh-CN.md`

Outcome:

- Local and CI-style fixture replay gate usage is now explicit.
- Automation is pointed at JSON output; humans are pointed at summary output.

## Completed. Governed Trace Fixture Builder CLI

Why:

- The project can export governed trace artifacts and validate committed fixtures, but refreshing fixtures still requires manual JSON handling.
- A local builder command can convert a governed artifact JSON file into a fixture JSON document on stdout.
- This keeps fixture maintenance inside the governed artifact boundary without adding runtime write paths.

Delivered:

- Added `scripts/trace-fixtures/build-fixture.mjs`.
- Added `npm run trace:fixture:build -- <artifact.json>`.
- The command reads one governed trace artifact JSON file, builds a fixture with `buildControlledTraceFixture()`, validates it, and prints fixture JSON to stdout.
- Missing files, malformed JSON, and invalid artifact shapes exit non-zero with stable stderr diagnostics.
- Added subprocess coverage for success, missing-file failure, and invalid artifact shape failure.
- Included the builder CLI test in `test:controlled-runtime`.
- Kept scope pure: no LLM calls, no tool calls, no route calls, no runtime store mutation, no fixture writeback, and no asset writes.

Primary files:

- `scripts/trace-fixtures/build-fixture.mjs`
- `src/__tests__/scripts/trace-fixture-builder-script.test.ts`
- `package.json`

Outcome:

- A maintainer can export a governed trace artifact, run one command, and inspect the resulting fixture JSON before committing it.
- Fixture refresh remains explicit and reviewable.

## Completed. Governed Fixture Refresh Review Workflow

Why:

- The project can now export governed artifacts, build fixture JSON, and validate the committed catalog.
- The remaining maintenance gap is the human review path for replacing a stale committed fixture safely.
- A documented refresh workflow should make fixture updates repeatable without adding automatic writes.

Delivered:

- Added `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`.
- Documented the exact maintainer sequence: export governed artifact, save it locally, run `trace:fixture:build`, inspect candidate fixture JSON, manually replace a committed fixture, run catalog/runtime gates, and review git diff.
- Added review checks for schema version, playbook id/version, step order, approval state, writeback targets, redaction flags, tool output redaction, sensitive string search, and git diff review.
- Linked the guide from the controlled runtime manual and documentation index.
- Kept committed fixture replacement manual and reviewable.
- Kept scope pure: no auto-write command, no filesystem discovery, no runtime store mutation, no tool replay, and no asset writes.

Primary files:

- `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/DOCUMENTATION_INDEX.zh-CN.md`

Outcome:

- Maintainers now have a fixed path for refreshing governed fixtures without inventing ad hoc steps.
- The builder command remains stdout-only, and committed fixture replacement remains a reviewed manual action.

## Completed. Fixture Replay Depth And Golden Invariants

Why:

- Current pure replay caught step order, approval state, and writeback target drift.
- Maintainers also need drift checks for the stable metadata that powers governed fixture review, Runtime Console deep links, and record focus.
- This deeper gate should still avoid real replay, tool simulation, routes, stores, and asset writes.

Delivered:

- Pure fixture replay now checks playbook version, scenario id, plan id, plan step count, and plan approval flag against the current registered playbook.
- Replay diagnostics now include expected and fixture plan/version/scenario metadata.
- Completed fixture steps must record at least one attempt.
- Completed approval-gated steps must carry approved terminal state.
- Successful writeback receipts must carry stable `assetId`, `sourceKey`, and `workflowRunId` metadata.
- Replay remains pure: no LLM calls, no tool execution, no API route calls, no runtime store mutation, and no asset writes.

Primary files:

- `src/lib/executor/runtime/trace-replay.ts`
- `src/__tests__/lib/executor/runtime/trace-replay.test.ts`

Outcome:

- Fixture replay now catches subtle plan/writeback identity drift before a fixture refresh is accepted.
- Catalog reports and `npm run trace:fixtures` inherit the deeper diagnostics automatically.

## Completed. Fixture Replay Contract Documentation

Why:

- The replay runner now enforces a broader invariant matrix.
- Maintainers refreshing fixtures need a concise reference for which field failed and why it matters.
- This documentation should come before adding more automation around fixture replay summaries.

Delivered:

- Added `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`.
- Documented the replay invariant matrix for fixture schema, redaction, playbook registration, version/scenario, step order, plan metadata, approvals, writeback targets, stable writeback metadata, completed attempts, and no-side-effect guarantees.
- Added a diagnostics reference for every current `ControlledTraceReplayDiagnostics` field.
- Added failure triage for playbook drift, stale fixtures, bad governed artifact source, and unsafe candidate fixtures.
- Linked the guide from the governed fixture refresh workflow and documentation index.

Primary files:

- `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- `docs/DOCUMENTATION_INDEX.zh-CN.md`

Outcome:

- Maintainers can interpret `failedItems[].replayErrors` and `failedItems[].diagnostics` without reading replay source.
- The fixture refresh workflow now has a clear decision point before replacing committed fixtures.

## Completed. Fixture Replay Error Summary CLI

Why:

- `npm run trace:fixtures` intentionally outputs machine-readable JSON.
- Maintainers now have the contract guide, but a concise human-readable local failure summary would reduce triage friction.
- This should stay separate from the JSON command so CI integrations remain stable.

Delivered:

- Added `npm run trace:fixtures:summary` as a human-readable governed fixture replay summary command.
- Kept `npm run trace:fixtures` as the stable machine-readable JSON command.
- Added a formatter for aggregate counts, catalog ids, playbook ids, no-side-effect guarantees, replay errors, validation errors, and high-signal diagnostics.
- Added synthetic failure coverage so summary diagnostics render without making committed fixtures fail.
- Included the summary command coverage in `test:controlled-runtime`.

Primary files:

- `scripts/trace-fixtures/catalog-summary.mjs`
- `src/__tests__/fixtures/controlled-traces/catalog-summary.ts`
- `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`

Outcome:

- Maintainers can run one local command to see replay health in readable text.
- CI and automation can continue consuming the original JSON summary.

## Completed. Fixture Replay Failure Fixture Tests

Why:

- The summary formatter now has one synthetic failure test.
- More reusable synthetic failure fixtures would make future report/summary tests easier to extend.
- These fixtures should remain separate from committed governed fixtures so catalog health stays green.

Delivered:

- Added reusable synthetic failure fixture factories under the test fixture boundary.
- Covered playbook version drift and missing stable writeback metadata as reusable catalog entries.
- Extended catalog report tests to cover multiple reusable failed entries while preserving no-side-effect guarantees.
- Refactored summary failure diagnostics coverage to use `buildCombinedSummaryFailureCatalogEntry()` instead of inline mutation.
- Kept committed governed fixtures green.

Primary files:

- `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`
- `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`

Outcome:

- Future report and summary drift coverage can reuse explicit failure factories.
- The committed catalog remains a green source of truth for CI and fixture health.

## Completed. Fixture Replay Failure Exit-Code Harness

Why:

- The report builder and summary formatter can now consume reusable synthetic failed entries.
- The committed CLI commands must stay green, so process-level non-zero behavior needs a focused harness that can inject failed catalog inputs without altering the committed catalog scripts.
- This keeps exit-code coverage separate from fixture discovery, refresh, route calls, tool replay, store mutation, and asset writes.

Delivered:

- Added `scripts/trace-fixtures/catalog-failure-harness.mjs` as a direct-invoked test harness, not a public npm script.
- Added `src/__tests__/fixtures/controlled-traces/catalog-report-output.ts` so committed JSON output and harness JSON output share the same shape.
- Added subprocess coverage for failed JSON output, failed summary output, unknown format usage text, and committed command green behavior.
- Included the harness test in `test:controlled-runtime`.

Primary files:

- `scripts/trace-fixtures/catalog-failure-harness.mjs`
- `src/__tests__/fixtures/controlled-traces/catalog-report-output.ts`
- `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts`
- `scripts/trace-fixtures/catalog-report.mjs`

Outcome:

- Failed report and summary process behavior is covered without making committed fixture commands fail.
- `npm run trace:fixtures` and `npm run trace:fixtures:summary` remain green against committed fixtures.

## Completed. Fixture Replay Validation Failure Fixtures

Why:

- Current synthetic failures focus on replay drift against an otherwise valid fixture.
- Report and summary diagnostics should also cover validation failures from malformed governed fixtures.
- These validation failure fixtures should stay separate from committed governed catalog entries.

Delivered:

- Added reusable synthetic validation failure factories under the test fixture boundary.
- Covered missing `sourceRunId`, unredacted step input, and unredacted tool output cases.
- Extended catalog report tests to preserve validation errors and no-side-effect guarantees.
- Added summary formatter coverage for combined validation failure diagnostics.
- Kept committed governed fixtures and committed CLI commands green.

Primary files:

- `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`
- `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`

Outcome:

- Report and summary tests now cover both validation failures and replay drift failures.
- Maintainers can see validation-layer diagnostics in the same report/summary surfaces.

## Completed. Fixture Replay Catalog Expansion Review

Why:

- The committed fixture catalog now covers sales and support, but maintainers needed a rule for when to add more fixture JSON.
- More fixtures are useful only when they preserve durable contract coverage, not when they duplicate scenario variety.

Delivered:

- Added `docs/GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md`.
- Reviewed coverage by playbook, terminal state, approval behavior, writeback target family, stable metadata, and edge-case traces.
- Documented that no new committed fixture is needed in Phase 10t.
- Defined future expansion triggers.

Outcome:

- The fixture catalog has a controlled maintenance path.
- Future fixture additions require a durable contract reason.

## Completed. Trace Governance Operational Runbook

Why:

- Trace governance had export, refresh, replay, CI gate, and catalog coverage docs, but no ordered maintainer lifecycle.
- Maintainers needed a single runbook that prevents command-order mistakes and keeps metadata replay separate from real replay.

Delivered:

- Added `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`.
- Documented export, artifact classification, fixture candidate build, candidate review, replay gates, failure escalation, retention, and handoff.
- Added explicit real replay boundaries.

Outcome:

- Governed trace operations now have one entry point.
- Future real replay work is clearly separated from current no-side-effect metadata replay.

## Completed. Project Direction Documentation Alignment

Why:

- Main entry docs still mixed early controlled-runtime gaps with the current governed trace baseline.
- Future sessions needed one consistent direction guardrail before starting real replay design.

Delivered:

- README, Project Framework, Roadmap, Architecture, Documentation Index, Next Steps, and Changelog now point to the same controlled runtime branch.
- Completed baseline is stated through Phase 10u.
- This alignment originally kept Phase 10v Real Replay Boundary Design as the next default task; Phase 10v is now complete and the current next phase is Replay Sandbox Contract Types.
- Generic OS shell expansion, generic skill marketplace work, and open-ended agent orchestration remain deprioritized until replay boundaries are designed.

Outcome:

- Maintainers can start from any major entry doc without drifting away from the controlled Playbook Runtime path.

## Completed. GPLv3 License Migration

Why:

- The project direction changed substantially and the source license needed to match the new governance posture.
- Maintainers needed one explicit migration boundary instead of scattered license wording.

Delivered:

- Current repository source license metadata now uses `GPL-3.0-or-later`.
- `LICENSE` contains the canonical GNU GPLv3 text.
- `package.json` and the root package entry in `package-lock.json` now declare `GPL-3.0-or-later`.
- README, NOTICE, documentation index, open-source checklist, changelog, and `docs/LICENSE_CHANGE_NOTICE.md` now point to the new license.
- Historical Apache-2.0 releases remain explicitly preserved under their previous license boundary.

Outcome:

- The repository now has a consistent GPLv3+ license posture for current source while avoiding ambiguity about older Apache-2.0 releases and third-party dependency licenses.

## Completed. Real Replay Boundary Design

Why:

- Current governed fixture replay is metadata-only and must remain no-side-effect.
- Future real replay needed an explicit sandbox, credential, approval, store, side-effect, provenance, and result ownership boundary before code starts.

Delivered:

- Added `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`.
- Defined allowed replay inputs and required provenance.
- Defined replay sandbox ownership, credential isolation, approval simulation, store isolation, side-effect blocking, and replay result artifact ownership.
- Added stop conditions for unsafe replay input, live credentials, production store access, business asset writes, unblocked side effects, and output that could be confused with real controlled runs.

Outcome:

- Future work can move to replay sandbox contract types without implementing real replay prematurely.

## Completed. Replay Sandbox Contract Types

Why:

- Phase 10v documented the real replay boundary, but the runtime layer needed executable TypeScript contracts before any prototype work.
- Future replay work needed a pure validator that rejects live credentials, production store access, business asset writes, and raw controlled run inputs.

Delivered:

- Added `src/lib/executor/runtime/replay-sandbox-contracts.ts`.
- Added `validateReplaySandboxContract()` with stable no-side-effect guarantees.
- Added replay result artifact shape helper for no-side-effect replay outputs.
- Added contract tests covering safe contracts, raw controlled run rejection, live credential rejection, live approval rejection, production store rejection, and business asset write rejection.
- Included the new test in `npm run test:controlled-runtime`.

Outcome:

- Future work can design a no-side-effect replay sandbox prototype against explicit contracts without touching production stores or business assets.

## Completed. No-Side-Effect Replay Sandbox Prototype Design

Why:

- Replay sandbox contracts are now executable, but prototype implementation needed one more design boundary.
- The prototype must stay separate from metadata fixture replay and must output only replay result artifacts.

Delivered:

- Added `docs/NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md`.
- Defined future `replay-sandbox.ts` module boundary and `runNoSideEffectReplaySandbox()` API shape.
- Required `validateReplaySandboxContract()` as preflight.
- Defined failure artifact behavior for unsafe contracts.
- Defined replay-local state, cursor events, approval simulation, side-effect blocking, and result artifact ownership.
- Preserved stop conditions against LLM replay, tool execution, route calls, runtime store access, and asset writes.

Outcome:

- Future implementation can build the smallest no-side-effect prototype without touching production stores or business assets.

## Completed. No-Side-Effect Replay Sandbox Prototype Implementation

Why:

- Prototype design was accepted, and the runtime needed the smallest executable no-side-effect sandbox before any fixture-to-contract bridge.
- The prototype must prove preflight failure behavior and artifact-only success behavior without integrating executor, routes, stores, tools, UI, or business assets.

Delivered:

- Added `src/lib/executor/runtime/replay-sandbox.ts`.
- Added `runNoSideEffectReplaySandbox(contract)`.
- Extended replay result artifacts with `status` and replay-local `cursorEvents`.
- Unsafe contracts return failed artifacts with only `preflight` cursor advancement and validation diagnostics.
- Safe contracts return succeeded replay result artifacts with replay-local cursor events.
- Added prototype tests proving artifact shape isolation from controlled runs and business assets.
- Included the prototype test in `npm run test:controlled-runtime`.

Outcome:

- The runtime now has a pure contract-to-artifact replay sandbox prototype.
- It still performs no LLM replay, no tool execution, no route calls, no runtime store reads/writes, and no asset writes.

## Completed. Governed Fixture To Replay Sandbox Contract Bridge

Why:

- The no-side-effect replay sandbox prototype accepted only `ReplaySandboxContract`.
- Committed governed fixtures needed a pure bridge into that contract shape before any catalog-level sandbox report.

Delivered:

- Added `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts`.
- Added `buildReplaySandboxContractFromFixture(fixture, options)`.
- Converted committed fixture metadata into `ReplaySandboxContract` with `committed_fixture` provenance, fixture credentials, fixture-derived approval decisions, fixture-only store policy, and replay-result-only output policy.
- Rejected broken provenance and redaction boundaries with structured errors.
- Proved current sales/support committed fixtures flow through `fixture -> contract -> no-side-effect replay artifact`.
- Included the bridge test in `npm run test:controlled-runtime`.

Outcome:

- The runtime can now bridge committed governed fixtures into the no-side-effect replay sandbox prototype without reading stores, calling routes, executing tools, modifying fixture JSON, or writing assets.

## Completed. Catalog-Level Replay Sandbox Report

Why:

- The fixture-to-contract bridge proved a single committed fixture can enter the no-side-effect sandbox path.
- Maintainers needed a catalog-level aggregate before adding a local CI-style command.

Delivered:

- Added `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`.
- Added `buildReplaySandboxCatalogReport()` over explicit committed fixture catalog entries.
- Each item preserves catalog id, fixture id, playbook id, contract build result, sandbox artifact, errors, and pass/fail status.
- Aggregate report preserves total/passed/failed counts, fixture ids, playbook ids, and no-side-effect guarantees.
- Added failed contract-build coverage and per-item artifact / simulated approval assertions.
- Included the report test in `npm run test:controlled-runtime`.

Outcome:

- Committed sales/support governed fixtures now have a catalog-level report for `fixture -> contract -> no-side-effect replay artifact`.
- The report remains no-side-effect: no real replay, no route calls, no runtime store reads/writes, no fixture JSON changes, and no asset writes.

## Completed. Replay Sandbox Catalog CI Summary

Why:

- The replay sandbox catalog report needed a local CI-style surface.
- Maintainers need a machine-readable command that fails non-zero when committed fixtures cannot enter the no-side-effect sandbox path.

Delivered:

- Added `npm run replay:sandbox:fixtures`.
- Added `scripts/trace-fixtures/replay-sandbox-catalog-report.mjs`.
- Added compact output helper `replay-sandbox-report-output.ts`.
- Added direct test-only failure harness proving failed reports emit parseable JSON and exit `1`.
- Included the subprocess test in `npm run test:controlled-runtime`.

Outcome:

- Committed sales/support governed fixtures now have both a TypeScript report helper and a local compact JSON CI command.
- The command remains no-side-effect: no real replay, no route calls, no runtime store reads/writes, no fixture JSON changes, and no asset writes.

## Recommended Next. Replay Sandbox Failure Diagnostics Hardening

Suggested scope:

- Add reusable synthetic sandbox / contract failure coverage.
- Keep `replay:sandbox:fixtures` failed output shape stable.
- Distinguish contract bridge failure, sandbox preflight failure, and guarantee failure diagnostics.
- Do not add failing committed fixture JSON.

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
