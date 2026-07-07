# AgentCore OS Changelog

## v1.5.1 - 2026-05-25

### Multi-Step Engine Hardening

- Added structured JSON execution logger (`src/lib/executor/logger.ts`) with `executorLog()` emitting timestamped events at execution start, step transitions, failures, and completion.
- Wired token usage tracking from LLM tool responses into `StepResult.tokensUsed` for per-step cost visibility.
- Made all tool HTTP calls use injectable `baseUrl` from request config instead of hardcoded paths.
- Added planner retry-on-parse-failure (up to 2 retries with relaxed prompt on second attempt).

### Client-Side Multi-Step UI

- Created `useMultiStepStream` hook for consuming the SSE `/api/agent/stream` endpoint with reactive state (plan, steps, approvals, errors).
- Created `MultiStepPanel` component showing real-time step progress, status badges, approval buttons, and error display.
- Integrated `MultiStepPanel` into `CommandCenterSidebar` — renders automatically when a workflow run is in "running" state.

### Workflow ↔ Executor Integration

- Created `runWorkflowMultiStep` orchestrator (`run-workflow-multi-step.ts`) that streams multi-step execution for eligible workflows and syncs state back to the workflow-runs store.
- Added in-memory `approval-store` with `waitForApproval` / `resolveApproval` and configurable timeout (default 5 min).
- Confirmed `/api/agent/stream` SSE endpoint and `/api/agent/approve` endpoint are fully wired end-to-end.

### Testing

- 68 tests across 13 test files (up from 32 tests / 7 files).
- New test coverage: planner (retry logic), guardrails (budget/forbidden tools), tool registry, step-executor (multi-step loop, failure abort, approval gates), approval-store (resolve/reject/timeout), workflow multi-step orchestrator (eligibility, SSE mock, error handling).

### Verification

- `npx tsc --noEmit` — zero errors
- `npx vitest run` — 68 tests passing
- `npm run test:core-workflows` — all regressions pass
- `npm run build` — production build succeeds

## v1.5.0 - 2026-05-24

### Multi-Step Agent Execution Engine

- Introduced a multi-step execution engine that decomposes high-level goals into sequenced, tool-calling steps with dependency tracking, human approval gates, and automatic failure recovery.
- Added `planSteps()` planner that calls LLM with structured output to produce an `ExecutionPlan` of atomic `ExecutionStep` items, each annotated with required tools, dependencies, and execution mode (auto/assist/review/manual).
- Implemented `executeMultiStep()` loop with per-step tool dispatch, consecutive-failure abort (3 strikes), time-budget enforcement, and dependency-aware scheduling.
- Created Tool Registry (`src/lib/executor/tools/registry.ts`) with `registerTool` / `getTool` / `getToolsForStep` API and 5 built-in tools: `llm_generate`, `knowledge_search`, `file_read`, `file_write`, `code_execute`, `human_ask`.
- Added safety guardrails module (`guardrails.ts`) with plan validation, token/time budget checks, forbidden-tool enforcement, and `decideRecovery()` for retry/replan/abort decisions.
- Added SSE streaming endpoint (`POST /api/agent/stream`) emitting `plan_ready`, `step_start`, `step_progress`, `step_complete`, `approval_needed`, `error`, and `execution_done` events.
- Added human approval endpoint (`POST /api/agent/approve`) for approving or rejecting individual steps mid-execution.
- Created workflow bridge (`workflow-bridge.ts`) to convert existing `WorkspaceScenario` stages into `ExecutionStep` arrays for multi-step execution.
- Extended `contracts.ts` with `AgentCoreMultiStepPolicy`, `ExecutionPlan`, `ExecutionStep`, `StepResult`, `MultiStepTrace`, `ExecutionCallbacks`, `GuardrailConfig`, and `ToolCallSpec` types.
- Added `runMultiStepTask()` entry point in `core.ts` — fully backward-compatible with existing single-turn `runAgentCoreTask()`.

### Verification

- `npx tsc --noEmit` — zero errors
- `npm run lint` — no new warnings
- `npx vitest run` — 32 tests passing
- `npm run test:core-workflows` — all regressions pass
- `npm run build` — production build succeeds

## v1.4.0 - 2026-05-23

### Architecture: page.tsx Decomposition

- Reduced `src/app/page.tsx` from 3085 lines to 591 lines (81% reduction).
- Extracted `SolutionCenterPanel` (1012 lines), `AgentSidebar` (770 lines), `ShellUI` (420 lines, 7 components), `WorkspaceAppWidgetGrid` (168 lines), `CommandCenterSidebar` (239 lines) into standalone component files.
- Extracted `useDesktopScroll` hook and `desktop-helpers.ts` shared utilities.

### State Management: Zustand Migration

- Introduced Zustand 5.0.3 for global state management.
- Created `desktop-store` (settings, language, provider, sidebar, onboarding state) and `window-store` (window lifecycle, z-order, focus).
- Migrated all page.tsx `useState` calls to Zustand store selectors.
- Rewrote `useDesktopWindows` as a thin wrapper over `useWindowStore`, preserving keyboard shortcuts and animation transitions.

### API Route Deduplication

- Created `state-route-factory.ts` providing `createStateRouteHandlers` and `createDeleteHandler` for standard CRUD routes.
- Migrated 10 route pairs (deals, tasks, support, knowledge-assets, sales-assets, support-assets, research-assets, creator-assets, workflow-runs, drafts) from ~82 lines each to ~15 lines of configuration.

### Performance: json-store Memory Cache

- Added mtime-validated in-memory read cache to `json-store.ts` with 30-second TTL.
- Cache is updated on writes and invalidated when file mtime changes, reducing disk reads for hot paths.
- Exported `invalidateCache()` for test isolation.

### Performance: React.memo and Lazy Loading

- Wrapped `AppWindowShell`, `SystemTrayWindows`, `CommandCenterSidebar`, `DesktopIcon` with `React.memo`.
- Added `{ loading: () => null }` to 16 infrequently-used app window `dynamic()` imports for faster perceived load.

### Testing Infrastructure

- Added Vitest 3.x with `@testing-library/react`, jsdom environment, and path alias support.
- 32 tests across 7 test files: stores (desktop-store, window-store), server layer (json-store cache, state-route-factory), and UI components (WorkspaceAppWidgetGrid, SystemTrayWindows, ShellUI).
- Added `npm run test` and `npm run test:watch` scripts.

### Verification

- `npx tsc --noEmit` — zero errors
- `npm run lint` — no warnings or errors
- `npx vitest run` — 32 tests passing
- `npm run test:core-workflows` — all regressions pass
- `npm run test:publish` — all regressions pass
- `npm run build` — production build succeeds

## Unreleased

### Playbook Control Audit

- Added `npm run playbook:control:audit`, a local read-only control-chain audit for registered controlled playbooks.
- The audit checks catalog uniqueness, schemas, tool boundaries, approval gates, failure policy, writeback/result asset alignment, and governed fixture coverage.
- Aligned `sales-pipeline-v1.resultAssets` with its actual durable writebacks by declaring `draft` and `workflow_run` alongside `sales_asset` and `knowledge_asset`.
- Added control-audit helper and CLI coverage to `test:controlled-runtime`.
- Added `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md` to record that the core runtime is established but the original design goals are not yet fully complete.

### Release Handoff Evidence Audit

- Added `npm run release:handoff:evidence:audit`, a local read-only cross-snapshot audit for recent handoff evidence.
- The audit summarizes successful, failed, invalid, invalid-JSON, full-commit-covered, and missing-full-commit snapshots by reusing the checked snapshot index.
- The command emits findings and next-command guidance without running the handoff gate, generating snapshots, mutating evidence, publishing, tagging, uploading, packaging, creating GitHub Releases, running browser smoke, or claiming production readiness.
- Added audit coverage and included it in `test:controlled-runtime`.

### Release Handoff Evidence Commit Hardening

- New `release:handoff:snapshot` evidence records `git.commitFull` alongside the existing short `git.commit` value.
- Snapshot validation accepts old short-only evidence and validates `git.commitFull` when present.
- Evidence freshness, doctor, and status checks now prefer full-SHA matching for new evidence and fall back to short-SHA matching for old local snapshots.
- The hardening remains local-only and performs no publishing, tagging, uploading, installer packaging, GitHub Release creation, browser smoke, or production-readiness claim.

### Release Handoff Evidence Status

- Added `npm run release:handoff:evidence:status`, a local read-only status summary for handoff evidence review.
- The command aggregates the existing evidence doctor and checked snapshot index helpers into one JSON report with `readyForLocalHandoffEvidence`, `nextCommand`, and `nextAction`.
- The status command does not run the full handoff gate, generate snapshots, mutate evidence, publish, tag, upload, package, create GitHub Releases, run browser smoke, or claim production readiness.
- Added evidence status coverage and included it in `test:controlled-runtime`.

### Release Handoff Evidence Doctor

- Added `npm run release:handoff:evidence:doctor`, a local read-only diagnostic helper for the newest handoff evidence snapshot.
- The command reports whether evidence is missing, invalid, failed, stale, unavailable because git cannot be read, or fresh for current `HEAD`.
- The doctor emits `nextCommand` and `nextAction` guidance without running that command and without creating, mutating, publishing, tagging, uploading, packaging, creating GitHub Releases, running browser smoke, or claiming production readiness.
- Added evidence doctor coverage and included it in `test:controlled-runtime`.

### Release Handoff Evidence Freshness

- Added `npm run release:handoff:evidence:check`, a local read-only freshness gate for the newest handoff evidence snapshot.
- The command validates the newest snapshot with the existing snapshot validator and compares `snapshot.git.commit` with current `HEAD`.
- Stale, missing, invalid, or failed evidence exits non-zero without creating, mutating, publishing, tagging, uploading, packaging, creating GitHub Releases, running browser smoke, or claiming production readiness.
- Added evidence freshness coverage and included it in `test:controlled-runtime`.

### Release Handoff Snapshot Index

- Added `npm run release:handoff:snapshot:index`, a local read-only index for handoff evidence snapshots under `output/release-handoff/`.
- The index lists snapshots newest first, supports `--limit <n>`, and can validate listed snapshots with `--check` by reusing the snapshot validator.
- The command performs no evidence creation, mutation, publishing, tagging, artifact upload, installer packaging, GitHub Release creation, browser smoke, or production-readiness claim.
- Added snapshot index coverage and included it in `test:controlled-runtime`.

### Release Handoff Snapshot Validation

- Added `npm run release:handoff:snapshot:check -- <snapshot.json>`, a local read-only validator for handoff evidence snapshot schema and release-boundary fields.
- The validator checks `productionReady: false`, `publishingPerformed: false`, `evidenceOnly: true`, git context shape, embedded `release:handoff:check` report shape, and release-claim rules for successful vs failed snapshots.
- Added snapshot validation coverage and included it in `test:controlled-runtime`.

### Release Handoff Retry Stability

- Honored explicit `retryBaseMs` / `retryMaxMs` values in server-backed list state while keeping the default retry timings at `750ms` and `30_000ms`.
- Added fake-timer coverage proving failed server-backed upserts retry using explicit sub-100ms local harness timing and drain the pending sync status.
- Included server-backed retry timing coverage in `test:controlled-runtime` to reduce release handoff gate flake risk.

### Release Handoff Evidence Snapshot

- Added `npm run release:handoff:snapshot`, a local-only evidence command that runs the full handoff gate and writes a JSON snapshot under `output/release-handoff/`.
- Snapshot files include the parsed `release:handoff:check` report plus git branch, commit, dirty status, tracked-change status, and untracked-file status.
- The command preserves `productionReady: false`, `publishingPerformed: false`, and `evidenceOnly: true`; it performs no publishing, tagging, artifact upload, installer packaging, or GitHub Release creation.
- Added snapshot helper coverage and included it in `test:controlled-runtime`.

### Local Release Handoff Gate

- Added `npm run release:handoff:check`, a full local handoff gate that aggregates open-source hygiene, delivery readiness, controlled runtime tests, core workflow regressions, lint, build, and `git diff --check`.
- The gate emits machine-readable JSON with `releaseClaim: "local_release_handoff_ready"`, `productionReady: false`, and `publishingPerformed: false`.
- The gate performs no publishing, tagging, artifact upload, installer packaging, or GitHub Release creation.
- Added release handoff helper coverage and included it in `test:controlled-runtime`.

### Open Source Hygiene Gate

- Added `npm run release:hygiene:check`, a local read-only open-source hygiene gate for public handoff checks.
- The gate verifies required public governance docs, `GPL-3.0-or-later` package metadata, tracked build/private artifact paths, and public release boundary wording.
- Secret pattern review is warning-only and reports file-level match counts for human review without claiming the repository has no secrets.
- Added release hygiene helper coverage and included it in `test:controlled-runtime`.

### Public Release Boundary Alignment

- Aligned public release and open-source checklist docs with the current Controlled Skill / Playbook Runtime direction.
- Reframed public release wording around `v1.3.0`, local delivery demo readiness, and `npm run delivery:ready:check`.
- Kept production readiness, real replay, external writes, and packaged installer distribution outside the current public release claim.

### Delivery Release Gate Hardening

- Added `npm run delivery:ready:check`, a fast local delivery readiness gate that aggregates delivery demo validation, governed trace fixture checks, fixture summary output, and retention preview.
- The gate emits machine-readable JSON, keeps `productionReady: false`, and only allows the `local_delivery_demo_ready` release claim.
- Added delivery readiness gate helper coverage and included it in `test:controlled-runtime`.

### Trace Operations Retention Preview

- Added a dry-run retention preview for controlled execution runs.
- `previewControlledExecutionRunRetention()` now reports kept/pruned run ids, policy cutoff, and per-run retention reasons without mutating storage.
- Refactored `pruneControlledExecutionRuns()` to reuse the same decision logic as preview, so cleanup behavior and preview output cannot drift.
- Added retention preview regression coverage for active runs, approval-blocked runs, newest terminal retention, terminal runs inside the retention window, and expired terminal pruning.
- Added `npm run trace:retention:preview` as a local dry-run operator command for machine-readable retention reports.
- The command supports `--max-age-ms`, `--max-age-days`, `--min-terminal-runs`, `--now`, and `--cwd`, and is covered by `test:controlled-runtime`.
- Added guarded local `npm run trace:retention:prune`, which requires `--confirm-prune` and exact `--expected-pruned-run-ids` matching a fresh preview before mutating controlled run storage.
- The guarded prune command keeps `none` as a no-mutation handoff path when the fresh preview has no prune candidates.

### Project Introduction Alignment

- Updated the README project introduction to distinguish AgentCore OS from ordinary skills and generic AI OS shells.
- Added framework-level language explaining the current Controlled Skill / Playbook Runtime position: skills/playbooks describe the workflow, while Runtime enforces deterministic execution, approval, trace, recovery, and asset writeback.

### Runtime UI Delivery Polish

- Added `buildControlledRunDeliverySummary()` to summarize recent controlled runs for delivery handoff.
- Runtime Console now shows a compact `Delivery handoff` band above controlled run filters with recent run count, pending approvals, retryable failures, asset landings, governed trace candidates, and an action/evidence status label.
- Kept the slice scoped to Runtime Console delivery readability; no broad desktop shell redesign, app routing change, runtime behavior change, approval semantic change, writeback change, or trace governance change.
- Added helper and component regression coverage for the new handoff summary.
- Added `docs/RUNTIME_UI_DELIVERY_POLISH_CLOSEOUT.zh-CN.md` with screenshot evidence and final stage boundary.
- Verified the new handoff UI in browser with Playwright; screenshot evidence is stored locally at `output/playwright/runtime-ui-delivery-handoff.png`, with 0 browser console errors.

### Delivery Demo Smoke Path

- Added deterministic local delivery demo data for completed, awaiting approval, and retryable failed controlled runs.
- Added `npm run delivery:demo:seed` to merge demo records into `.openclaw-data` while preserving unrelated local records.
- Added `npm run delivery:demo:check` to verify demo run states, writeback targets, related sales / knowledge / workflow / draft / support assets, retry/approval metadata, and governed trace redaction.
- Added delivery demo script tests and included them in `test:controlled-runtime`.
- Added `docs/DELIVERY_DEMO_SMOKE_PATH.zh-CN.md` as the operator guide for Home -> Runtime Console -> asset landing -> governed trace copy.
- Added `docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md` with Playwright browser smoke evidence and release-readiness boundaries.
- Verified the browser path Home -> Runtime Console -> `delivery-demo-run-completed` -> five asset landings -> governed trace copy with 0 console errors.
- Set the next phase to Governed Fixture And Playbook Expansion Review.

### Post-Delivery Fixture And Playbook Expansion Review

- Added a governed fixture/playbook coverage regression proving every registered controlled playbook has one committed governed fixture entry.
- Added `docs/POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md`.
- Recorded the decision not to add new fixture JSON or migrate a new playbook immediately after local delivery smoke.
- Set the next phase to Trace Operations Hardening.

### Runtime Console Delivery Readiness Audit

- Added `docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md`.
- Documented the current deliverable demo story from Home cockpit to Runtime Console, asset landing, and governed trace copy.
- Identified the then-next blocker as a fixed Delivery Demo Smoke Path before production-readiness claims.

### Runtime UI Reframing

- Added a runtime cockpit summary model for the home command center.
- Reframed the home first viewport around controlled playbook state, approvals, recovery, and governed trace / replay gates.
- Added a visible Runtime Console primary inspection action on the home cockpit.
- Included the runtime cockpit summary test in `test:controlled-runtime`.
- Fixed replay sandbox fixture contract governance-mode typing so the production build gate stays green after the runtime UI reframing slice.
- Expanded `test:controlled-runtime` to 36 files / 191 tests.

### Replay Sandbox Failure Harness Expansion

- Added direct replay sandbox failure harness modes for `contract`, `sandbox`, and `guarantee` failures.
- Kept the no-argument harness mode backward-compatible with contract failure output.
- Added unknown-mode fail-closed behavior with exit `2` and no report JSON.
- Preserved committed `npm run replay:sandbox:fixtures` as an all-green no-side-effect command.

### Replay Sandbox Failure Diagnostics Hardening

- Added replay sandbox failure diagnostics taxonomy for contract, sandbox, and guarantee failures.
- Classified replay sandbox catalog failures as `contract_build_failed`, `sandbox_artifact_failed`, or `guarantee_violation`.
- Added `failureKind` and `guaranteeErrors` to compact failed replay sandbox catalog JSON output.
- Added synthetic/test-only failure coverage without adding failing committed fixture JSON or changing the no-side-effect replay boundary.

### Replay Sandbox Catalog CI Summary

- Added `npm run replay:sandbox:fixtures` for compact JSON replay sandbox catalog health.
- The command reports committed fixture contract/artifact status and exits non-zero when the report is not green.
- Added a test-only failure harness proving failed replay sandbox reports produce parseable JSON and exit `1`.
- Included the script regression in `test:controlled-runtime`.

### Catalog-Level Replay Sandbox Report

- Added `buildReplaySandboxCatalogReport()` for committed governed fixture catalog entries.
- The report runs each fixture through `fixture -> ReplaySandboxContract -> no-side-effect replay result artifact`.
- Preserves per-fixture contract build results, sandbox artifacts, diagnostics, and no-side-effect guarantees.
- Added catalog report tests and included them in `test:controlled-runtime`.

### Governed Fixture To Replay Sandbox Contract Bridge

- Added `buildReplaySandboxContractFromFixture()` to convert committed governed fixture metadata into `ReplaySandboxContract`.
- Proved current sales/support fixtures can flow through `fixture -> contract -> no-side-effect replay artifact`.
- Added structured rejection for broken fixture provenance and redaction boundaries.
- Added bridge tests and included them in `test:controlled-runtime`.

### No-Side-Effect Replay Sandbox Prototype Implementation

- Added `runNoSideEffectReplaySandbox()` as a pure contract-to-artifact prototype that validates replay sandbox contracts before all other work.
- Unsafe contracts now return failed replay result artifacts with only `preflight` cursor advancement and validation diagnostics.
- Safe contracts return replay-local result artifacts with no executor, route, store, tool, UI, or business asset side effects.
- Added prototype tests and included them in `test:controlled-runtime`.

### No-Side-Effect Replay Sandbox Prototype Design

- Added a no-side-effect replay sandbox prototype design guide covering future module boundaries, preflight validation, replay-local state, cursor events, approval simulation, side-effect blocking, result artifacts, and stop conditions.

### Replay Sandbox Contract Types

- Added TypeScript-only replay sandbox contract types and validation for replay input provenance, credentials, approval simulation, store isolation, side-effect policy, and replay result artifacts.
- Added no-side-effect contract tests and included them in `test:controlled-runtime`.

### Real Replay Boundary Design

- Added a real replay boundary guide covering replay input provenance, sandbox ownership, credential isolation, approval simulation, store isolation, side-effect blocking, replay result ownership, and stop conditions before any real replay implementation.
- Aligned the project framework, roadmap, documentation index, governed trace runbook, controlled runtime manual, and next-stage backlog around Replay Sandbox Contract Types as the next no-side-effect phase.

### License Migration

- Changed current repository source license metadata from Apache-2.0 to GPL-3.0-or-later.
- Added a license change notice preserving the historical Apache-2.0 boundary for previously published versions.
- Updated README, NOTICE, package metadata, and open-source release checklist to reflect the new license.

### Project Direction Documentation Alignment

- Aligned README, project framework, roadmap, architecture, documentation index, and next-stage backlog around the current Controlled Skill / Playbook Runtime branch.
- Recorded the completed baseline through governed trace operational runbook work; the later real replay boundary guide now moves the next default task to Replay Sandbox Contract Types.
- Re-stated direction guardrails against generic OS shell expansion, generic skill marketplace work, and open-ended agent orchestration before controlled replay boundaries are designed.

### Controlled Playbook Runtime

- Added the `sales-pipeline-v1` controlled playbook path with fixed step order, playbook validation, durable controlled run records, persistent approval records, and resume routing.
- Wired the multi-step client to recover durable controlled runs after approval, stream loss, resume conflicts, interrupted approval streams, and manual recovery actions.
- Added the compact `继续执行` recovery action to the multi-step panel and a `恢复中` runtime status badge aligned with the operational cockpit design contract.
- Added regression coverage for fixed playbook execution, controlled runtime persistence, resume route conflicts, stale stream/resume races, rejected approvals, missing run ids, and interrupted approval streams.

### Controlled Run Asset Writeback

- Added server-backed controlled writeback for approved `sales-pipeline-v1` outputs into sales assets and knowledge assets.
- Made controlled writeback idempotent by `workflowRunId` / controlled run source key, and recorded concrete writeback receipts in durable controlled step trace records.
- Added server-backed controlled writeback for `workflow_run` and `draft` targets.
- Made workflow run writeback idempotent by stable `workflowRunId` and draft writeback idempotent by `controlled-draft:{workflowRunId}`.
- Final approved writeback now records `sales_asset`, `knowledge_asset`, and `workflow_run` receipts, while draft writeback is produced from the `draft_outreach` step.

### Runtime Console Record Focus

- Extended support asset lookup with exact `assetId`, stable `sourceKey`, and `workflowRunId` fallback helpers.
- Runtime Console support asset landings now pass `assetId`, `sourceKey`, and workflow context into Support Copilot.
- Support Copilot treats exact support asset prefills as record-focus requests, selects the related existing support ticket, and keeps broad support handoffs on the existing new-ticket path.
- Added pending hydration retry for support asset focus and a visible missing-record error that does not create synthetic support tickets.
- Added unit and resume integration coverage for approved writeback, unapproved skips, workflow/draft writes, idempotency, and final resume-driven asset creation.

### Trace Governance

- Added a governed controlled-run trace artifact builder that preserves audit metadata while redacting run errors, step input/output, tool outputs, approval feedback, audit messages, and free-form plan text.
- Added `GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact` as a local-only route for export-safe trace artifacts.
- Kept the existing durable controlled run store and Runtime Console operational route unchanged.
- Expanded controlled runtime coverage to include trace governance redaction and the trace artifact route.

### Trace Governance Console Export And Retention

- Added export metadata to governed trace artifact responses, including filename, generated time, content type, and governance mode.
- Added a Runtime Console `复制脱敏 Trace` action that fetches the governed artifact route and copies only `{ export, artifact }` JSON.
- Added a conservative `pruneControlledExecutionRuns()` helper that removes old terminal controlled runs while keeping running and approval-blocked runs.
- Expanded controlled runtime coverage for console artifact copy, artifact export metadata, and retention prune safety.

### Trace Fixture Generation

- Added a governed trace fixture builder that converts `ControlledTraceArtifact` into stable replay-oriented metadata.
- Added fixture validation for redaction boundaries, step order, known playbook matching, tool output redaction, approval state, schema flags, and writeback target metadata.
- Added a committed sales pipeline governed trace fixture under `src/__tests__/fixtures/controlled-traces/`.
- Expanded `test:controlled-runtime` to cover governed trace fixture generation and validation.

### Trace Fixture Replay Runner

- Added a pure governed trace fixture replay runner that validates committed fixtures against the current controlled playbook catalog without invoking LLMs, tools, API routes, stores, or writeback helpers.
- Replay reports include checked step ids, deterministic errors, and explicit guarantees that no tool calls were executed and no assets were written.
- Replay validation checks base fixture safety, registered playbook existence, current step order, required approval state, and per-step writeback target coverage.
- Aligned the committed sales governed trace fixture with the current `sales-pipeline-v1` writeback / approval contract.
- Expanded `test:controlled-runtime` to include trace fixture replay coverage.

### Trace Fixture Catalog And Support Coverage

- Added an explicit governed trace fixture catalog for committed controlled trace fixtures.
- Added a committed `support-resolution-v1` governed trace fixture aligned with the current support playbook approval and writeback contract.
- Added catalog replay coverage that validates and replays every committed governed fixture without LLM calls, tool execution, route calls, store mutation, or asset writes.
- Expanded `test:controlled-runtime` to include sales and support fixture catalog replay.

### Trace Fixture Drift Diagnostics

- Extended pure governed trace fixture replay reports with structured drift diagnostics.
- Replay reports now include fixture id, playbook id, expected step order, fixture step order, missing approval step ids, and missing writeback targets.
- Preserved the existing stable replay `errors` strings while adding maintenance-oriented diagnostics for stale fixtures.
- Added replay tests for success diagnostics, step-order drift, missing approval state, missing writeback targets, and unregistered playbooks.
- Kept replay pure: no LLM calls, no tool execution, no API route calls, no runtime store reads/writes, and no asset writes.

### Trace Fixture Catalog Report

- Added a pure governed trace fixture catalog report helper for committed fixture health.
- Catalog reports now aggregate total, passed, failed, fixture ids, playbook ids, per-fixture validation results, per-fixture replay reports, and no-side-effect guarantees.
- Added all-green catalog report coverage for the committed sales and support governed fixtures.
- Added synthetic drift coverage proving aggregate report items preserve Phase 10f replay diagnostics.
- Kept the helper in the test fixture boundary; no production route, CLI, filesystem discovery, runtime store mutation, tool execution, or asset writeback was added.

### Trace Fixture Catalog CI Summary

- Added `npm run trace:fixtures` as a focused local governed fixture catalog health command.
- The command prints compact JSON with aggregate counts, fixture ids, playbook ids, failed item diagnostics, and no-side-effect guarantees.
- The command exits non-zero when the aggregate catalog report is not ok.
- Added a subprocess regression test for the command and included it in `test:controlled-runtime`.
- Updated fixture JSON imports to use standard Node ESM JSON import attributes so the catalog report can run outside Vitest.

### Governed Trace Fixture Builder CLI

- Added `npm run trace:fixture:build -- <artifact.json>` as a local governed artifact to fixture builder command.
- The command reads one governed trace artifact JSON file, builds a fixture through `buildControlledTraceFixture()`, validates it, and prints fixture JSON to stdout.
- Missing files, malformed JSON, and invalid artifact shapes now exit non-zero with stable stderr diagnostics instead of stack traces.
- Added subprocess regression coverage for success, unreadable input, and invalid governed artifact input.
- Kept the builder command pure: no LLM calls, no tool execution, no API route calls, no runtime store mutation, no automatic fixture writeback, and no asset writes.

### Governed Fixture Refresh Review Workflow

- Added `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md` as the manual refresh workflow for committed governed trace fixtures.
- Documented the exact maintainer sequence from governed artifact export through `trace:fixture:build`, candidate JSON review, manual committed fixture replacement, catalog health verification, runtime gate verification, and git diff review.
- Added explicit fixture review checks for schema version, playbook id/version, step order, approval state, writeback targets, redaction flags, tool output redaction, and sensitive string search.
- Linked the guide from the controlled runtime manual and documentation index.
- Kept fixture refresh manual and pure: no auto-write command, no filesystem discovery, no runtime store mutation, no LLM/tool replay, and no asset writes.

### Fixture Replay Golden Invariants

- Extended pure governed trace fixture replay with deeper plan/version/approval/writeback identity invariant checks and diagnostics while preserving no-side-effect guarantees.
- Replay now checks current playbook version, scenario id, expected plan id, plan step count, plan approval flag, completed step attempts, approved terminal state, and stable successful writeback metadata.
- Added replay tests for version drift, plan metadata drift, missing attempts, non-approved completed approval steps, and missing stable writeback metadata.

### Fixture Replay Contract Documentation

- Added `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md` as the Governed Trace Fixture Replay Contract guide covering invariant checks, diagnostics, failure triage, and maintainer commands for fixture refresh review.
- Linked the contract guide from the governed fixture refresh workflow and documentation index.

### Fixture Replay Error Summary CLI

- Added `npm run trace:fixtures:summary` as a human-readable governed fixture replay summary command while keeping `npm run trace:fixtures` as stable JSON.
- Added synthetic failure coverage for summary diagnostics without making committed governed fixtures fail.

### Fixture Replay Failure Fixture Tests

- Added reusable synthetic governed trace failure fixture factories for report and summary tests.
- Extended catalog report coverage for version drift and missing stable writeback metadata without adding failing fixtures to the committed catalog.
- Refactored summary failure diagnostics coverage to use reusable synthetic fixtures instead of inline fixture mutation.

### Fixture Replay Failure Exit-Code Harness

- Added a direct-invoked synthetic failure harness for governed fixture report and summary subprocess tests.
- Extracted the committed JSON report output shape into a shared helper used by both the committed command and the failure harness.
- Added non-zero exit coverage for failed JSON and human-readable summary paths while keeping committed fixture commands green.

### Fixture Replay Validation Failure Fixtures

- Added reusable synthetic validation failure fixture factories for missing source run id, unredacted step input, and unredacted tool output cases.
- Extended catalog report coverage to prove validation errors are preserved without adding failing fixtures to the committed catalog.
- Added human-readable summary coverage for combined validation failure diagnostics.

### Fixture Replay Failure Documentation Matrix

- Added a failure fixture matrix to the governed trace replay contract, mapping validation failures, replay drift failures, summary diagnostics, and the process exit harness to their source factories/tests and maintainer actions.
- Clarified that synthetic failures remain test-only fixtures and must not be added to the normal committed governed fixture catalog.
- Aligned the controlled runtime manual and next-stage backlog around using the matrix as the first fixture failure triage entry.

### Fixture Replay Refresh Review Checklist

- Added a pass/fail candidate fixture review checklist to the governed trace fixture refresh workflow.
- Split refresh review into source identity, redaction, playbook contract, approval state, writeback identity, failure triage, sensitive search, and replacement diff gates.
- Cross-linked candidate failure triage to the replay contract failure fixture matrix.

### Fixture Replay CI Gate Documentation

- Added a governed trace fixture CI gate guide documenting command roles for `trace:fixtures`, `trace:fixtures:summary`, and `trace:fixture:build`.
- Clarified that automation should consume stable JSON from `trace:fixtures`, while summary output remains human-readable triage.
- Documented local development, fixture refresh, and CI-style gate sequences without adding new CI automation.

### Fixture Replay Catalog Expansion Review

- Added a governed trace fixture catalog coverage guide documenting current sales/support fixture coverage.
- Recorded the decision that no new committed fixture is needed while sales and support cover all registered playbooks and current writeback target families.
- Added expansion rules for future fixtures based on new playbooks, durable writeback target families, stable terminal-state contracts, or real contract gaps.

### Trace Governance Operational Runbook

- Added a governed trace operational runbook covering artifact export, artifact intent classification, candidate fixture generation, refresh review, replay gates, retention, and handoff.
- Clarified stop conditions for unsafe artifacts, replay drift, missing stable writeback metadata, runtime gate failures, and summary/harness mismatches.
- Documented that current replay remains metadata-only and that real LLM/tool replay requires a separate design with side-effect controls.

### Runtime Console Trace Landing

- Added `GET /api/runtime/executor/controlled-runs` so the Runtime Console can load recent controlled playbook runs.
- Added a tested controlled run console summary helper that exposes step state counts, approvals, schema validation, writeback receipts, and sales/knowledge asset landing labels.
- Added a `受控运行 Trace` panel to the Runtime Console showing recent controlled runs, selected run metadata, step trace, approval state, receipt summaries, and asset landing identifiers.

### Runtime Console Operations

- Added tested console summary operation flags for pending approval step ids, approval availability, resume availability, and filtered controlled run lists.
- Added Runtime Console state filters and text search for recent controlled runs.
- Wired Runtime Console approve / reject actions through the existing `/api/agent/approve` route and controlled run resume through the existing resume route.
- Refreshed the controlled run list after console operations so approval and resume state stays aligned with durable runtime records.

### Runtime Console Asset Deep Links

- Added structured `assetId`, `sourceKey`, and `workflowRunId` metadata to successful controlled sales and knowledge writeback receipts.
- Surfaced structured asset landing metadata in Runtime Console summaries, including target app ids for Deal Desk and Knowledge Vault.
- Extended controlled run search to match asset ids, source keys, workflow ids, receipt summaries, and run errors.
- Added Runtime Console `打开` actions for successful sales and knowledge asset landings using the existing cross-app open event helpers.

### Runtime Console Failure Recovery

- Added durable controlled run audit events for console-initiated recovery actions.
- Added retry eligibility metadata to controlled run summaries: `failedStepId`, `canRetry`, `retryReason`, and `auditEventCount`.
- Added `retryControlledExecutionRun(runId)` and `POST /api/runtime/executor/controlled-runs/[runId]/retry`, gated by playbook `onFailure.action === "retry"`.
- Preserved completed prior step results while retrying from the first failed retryable step.
- Added Runtime Console failed-run recovery details and a `重试失败步骤` action for eligible failed runs.
- Expanded `test:controlled-runtime` so it covers console summary recovery metadata, retry route behavior, and Runtime Console retry UI wiring.

### Runtime Console Record-Level Asset Focus

- Added record-level lookup helpers for sales assets and knowledge assets.
- Extended Deal Desk and Knowledge Vault prefill contracts with optional `assetId`, `sourceKey`, and workflow metadata.
- Added stable sales asset `sourceKey` metadata to successful controlled writeback receipts.
- Runtime Console now forwards record focus metadata when opening successful sales and knowledge asset landings.
- Deal Desk now focuses an existing deal from sales asset prefill metadata instead of creating a duplicate lead.
- Knowledge Vault now focuses and highlights the exact knowledge asset from `assetId` / `sourceKey` prefill metadata.
- Deal Desk and Knowledge Vault now retry record focus after asset hydration; missing record-focus-only openings report an error instead of creating synthetic records.
- Legacy Runtime Console sales landings without structured record metadata now keep the broad Deal Desk fallback instead of receiving run-level record focus metadata.
- Expanded `test:controlled-runtime` to include record-level asset lookup, Deal Desk focus, and Knowledge Vault focus coverage.

### Runtime Console Workflow And Draft Deep Links

- Added Runtime Console landing summaries for successful `workflow_run` and `draft` writeback receipts.
- Mapped workflow run landings to Industry Hub and draft landings to Publisher.
- Added an Industry Hub prefill event so workflow run landings can focus the matching role/scenario.
- Reused Publisher draft prefill so draft landings open the written `draftId` with controlled run workflow context.
- Preserved the existing Runtime Console asset landing panel and sales/knowledge open actions while expanding the same trace landing flow to workflow and draft records.
- Expanded controlled runtime coverage for workflow/draft landing summaries, Runtime Console open actions, and Industry Hub workflow focus.

### Support Playbook Migration

- Added `support-resolution-v1` as the second controlled playbook for the existing `support-ops` scenario.
- Defined fixed support steps for intake, classify, draft reply, human review, and writeback with schemas, tool allowlists, approval gates, and writeback targets.
- Registered support playbook lookup by id and scenario in the controlled playbook catalog.
- Added server-backed support asset writeback through `support-assets.json`, idempotent by `controlled-support-asset:{workflowRunId}`.
- Extended controlled knowledge and draft writeback so support runs produce support-specific FAQ assets and reply drafts without breaking sales behavior.
- Added Runtime Console support asset landing summaries, search coverage, and `打开` action through the existing Support Copilot open event.
- Expanded controlled runtime coverage for support playbook resolution, support writeback, support execution, and support asset landings.

### Framework Alignment

- Added project-level `AGENTS.md` workflow rules and `DESIGN.md` design contract as the default collaboration and UI implementation framework for future work.
- Re-centered the next-stage backlog around controlled runtime reliability, traceability, approval recovery, and asset writeback instead of adding more app-shell surface area.
- Added `docs/PROJECT_FRAMEWORK.zh-CN.md` as the project-level framework for the controlled Skill / Playbook Runtime pivot.
- Rewrote the architecture, roadmap, next steps, README entry, documentation index, and contribution guidance so future work starts from the runtime direction instead of the old app-shell framing.

### Verification

- Verified `npm test -- src/__tests__/lib/executor/playbooks/support-resolution.test.ts` — 5 tests passing.
- Verified `npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts` — 8 tests passing.
- Verified `npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts` — 6 tests passing.
- Verified `npm test -- src/__tests__/lib/executor/runtime/resume.test.ts` — 10 tests passing.
- Verified `npm test -- src/__tests__/lib/executor/controlled-runtime.test.ts` — 7 tests passing.
- Verified `npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx` — 5 tests passing.
- Verified `npm test -- src/__tests__/components/IndustryHubAppWindow.test.tsx` — 1 test passing.
- Verified `npm test -- src/__tests__/components/DealDeskAppWindow.test.tsx` — 2 tests passing.
- Verified `npm test -- src/__tests__/components/KnowledgeVaultAppWindow.test.tsx` — 2 tests passing.
- Verified `npm test -- src/__tests__/lib/executor/runtime/trace-governance.test.ts src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts` — 2 files, 4 tests passing.
- Verified `npm test -- src/__tests__/app/api/controlled-run-trace-artifact-route.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx src/__tests__/lib/server/controlled-execution-store.test.ts` — 3 files, 14 tests passing.
- Verified `npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts` — 1 file, 3 tests passing.
- Verified `npm test -- src/__tests__/lib/executor/runtime/trace-fixtures.test.ts src/__tests__/lib/executor/runtime/trace-replay.test.ts src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` — 3 files, 11 tests passing.
- Verified `npm run test:controlled-runtime` — 26 files, 145 tests passing.
- Verified `npm run test:core-workflows` — all core workflow regressions passing.
- Verified `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- Verified `npm run build` — exit 0 with the same existing `<img>` warning.
- Verified `git diff --check` — exit 0.

### Security And Executor Hardening

- Added local API authorization checks to runtime sidecar, runtime state, executor health, executor session, and executor memory routes so `AGENTCORE_API_AUTH_TOKEN` protects the full local runtime surface consistently.
- Blocked private, loopback, and link-local webhook URLs in publish dispatch to reduce SSRF risk when webhook publishing is enabled.
- Hardened multi-step tool approval so tools marked `requiresApproval` cannot be executed without human approval, even when a step is planned as `auto` or a request asks for `approvalMode: none`.
- Added structured `ToolCallSpec.params` support so planners and callers pass explicit tool arguments instead of relying on descriptions or prompts as tool inputs.
- Fixed the `code_execute` integration by requiring explicit code, routing execution through the new guarded `/api/runtime/execute` endpoint, and returning bounded stdout/stderr/timeout results.

### Testing

- Added regression coverage for runtime sidecar authorization, state route authorization, publish webhook SSRF blocking, guarded tool approval, and `code_execute` request contracts.

### Verification

- Verified `npx vitest run`
- Verified `npm run test`
- Verified `npm run lint`
- Verified `npm run build`

### Security And Runtime Hardening

- Unified JSON request-body parsing across local API routes with explicit size limits, JSON content-type checks, and consistent `400` / `413` / `415` error semantics.
- Changed request-body reading to stream with an early cutoff so oversized requests without reliable `Content-Length` are rejected before the full body is consumed.
- Hardened local API token validation by comparing fixed-length SHA-256 token digests with `timingSafeEqual`, preserving Bearer and `x-agentcore-token` compatibility.
- Added regression coverage for local API authorization boundaries, oversized route bodies, streamed body cutoff behavior, and non-JSON request rejection.

### Internal Maintenance

- Extracted shared output-asset route serving logic for OpenClaw and runtime media asset endpoints.
- Split desktop window state, z-order, global shortcuts, and open/minimize/close transitions from `src/app/page.tsx` into a dedicated `useDesktopWindows` hook.
- Moved open-app prefill dispatch behavior into the shared UI event layer.

### Verification

- Verified `npm run test:core-workflows`
- Verified `npm run test:publish`
- Verified `npm run lint`
- Verified `npx tsc --noEmit`
- Verified `npm run build`
- Verified `npm run desktop:smoke-test-sidecar`

## v1.2.0 - 2026-03-28

### Workflow Recommendation And Runtime Stability Upgrade

- Expanded the shared workflow recommendation contract from Hero panels into the main execution surfaces for:
  - `Deal Desk`
  - `Support Copilot`
  - `Deep Research Hub`
  - `Content Repurposer`
  - `Inbox Declutter`
  - `Morning Brief`
- Promoted workflow-linked tasks into first-class recommendation and next-step signals so workflow surfaces can route users toward the same follow-up actions with a consistent structure.
- Kept deterministic local recommendation builders as the stable default, while preserving server-backed runtime overlays for Hero workflow summaries and suggestions.
- Deepened the current stable product line around sales, support, research, creator, knowledge accumulation, and publish-chain handoff rather than expanding into self-built low-level infrastructure.
- Added documented stability gates for the current public line:
  - `npm run test:core-workflows`
  - `npm run test:stability`
- Closed the desktop-shell parity gap for the runtime state and executor history APIs in the Python sidecar.
- Desktop shell execution via `/api/openclaw/agent` now records unified executor session history instead of bypassing the audit trail.
- Expanded desktop sidecar smoke coverage to verify:
  - executor session list/detail
  - deals tombstone boundary
  - support delete path
  - workflow-run scenario winner and tombstone behavior
- Added a documented cold-start validation baseline for the GitHub main branch.
- Expanded publish-account settings coverage so the configuration surface now matches the publish platforms already supported by the queue and dispatch layer.

### Verification

- Verified `npm run test:stability`

## v1.1.1 - 2026-03-22

### Maintenance Release

- Fixed Knowledge Vault process-asset reuse metrics so one-click reuse no longer increments reuse count before the workflow actually confirms reuse.
- Corrected public release wording to describe the `openclaw` to `runtime` route cleanup as a partial compatibility-preserving migration rather than a completed rename.
- Aligned GitHub and CNB release-facing docs so Chinese distribution guidance includes both repository entrypoints.
- Updated version references, release notes, launch copy, and release checklists around the `v1.1.1` maintenance line.

### Verification

- Verified `npm run lint`
- Verified `npm run build`

## v1.1.0 - 2026-03-22

### Sales and Support Workflow Upgrade

- Added a curated expert-role layer for high-frequency sales and support chains.
- Added stage-bound expert profiles:
  - `sales_qualification_specialist`
  - `outreach_draft_specialist`
  - `support_reply_specialist`
  - `reality_checker`
  - `knowledge_asset_editor`
- Deal qualification, outreach drafting, and support reply generation can now call expert-bound prompts while still staying inside existing workflow boundaries.
- Added `Reality Checker` as a review-stage safety layer before approval and handoff.
- Added expert-profile enable/disable controls in Settings so only a small approved whitelist is active.

### Workflow Asset Accumulation

- Sales and support records now persist review notes for human-visible audit.
- Completed sales and support workflows can now generate structured reusable asset drafts instead of only freeform text.
- Added a dedicated `knowledge-assets` store for structured process assets with status, tags, reuse count, and source jump targets.
- Personal CRM now supports confirming sales asset drafts into Knowledge Vault.
- Support Copilot now supports confirming FAQ / escalation-boundary assets into Knowledge Vault.

### Knowledge Vault

- Added a `流程资产` section to Knowledge Vault for structured sales and support assets.
- Added search, active/archived filtering, archive/restore, remove, source jump, and reuse counting for process assets.
- Upgraded one-click reuse from raw body injection to structured prefill parsing for:
  - `Deal Desk`
  - `Support Copilot`
- Knowledge Vault assets can now be edited in place:
  - title
  - applicable scene
  - tags
  - body
- Asset cards now expose lineage/audit metadata:
  - workflow run id
  - source key
  - created time
  - updated time

### Documentation and Release

- Aligned release-facing docs, product docs, and version references around `v1.1.0`.
- Added a dedicated `v1.1.0` release note and launch copy.
- Refreshed README, documentation index, user guide, hero workflow strategy, and public release guidance for the new stable line.

### Verification

- Verified `npm run lint`
- Verified `npm run build`

### Desktop and Workspace

- Desktop app area now groups apps by work category instead of rendering a single flat grid.
- Shared category metadata now drives category name, description, and placement guidance across both the desktop surface and Settings.
- Desktop overview cards now display category count and accurate Dock totals.
- Workspace presets have expanded to cover creator, sales, support, research, operations, personal, and language-learning scenarios.
- Industry App Center continues to package industry bundles, scenario-based setup, and custom workspace composition flows.
- Solutions Hub now maps mature use cases into installable workspace/app workflows.

### Settings and Personalization

- `App 配备` has been redesigned from simple checkbox rows into category cards with:
  - app counts per category
  - Desktop / Dock counts
  - bulk actions for `全选 Desktop`, `全选 Dock`, and `清空本类`
  - clearer per-app state copy
- Enabling custom workspace now initializes from the selected scenario when needed, instead of dropping users into an empty state unexpectedly.
- Custom workspace selections now honor explicit empty Desktop or Dock configurations instead of silently falling back to scenario defaults.

### Agent Sidebar

- Agent sidebar sessions now restore from local storage automatically.
- Orphaned message history can now be recovered into visible sessions when session metadata is missing.
- Session retention has been expanded to up to 40 sessions, with up to 120 messages stored per session.
- Session strip now supports scrolling through the full list and includes a quick `回到最近` action.
- New blank sessions are reused when possible to reduce duplicate empty conversations.
- Fixed a session-isolation bug where an in-flight reply could be written into the wrong conversation after switching sessions.

### Documentation and Onboarding

- `GETTING_STARTED.md` now splits setup into three practical tracks:
  - browser-only
  - desktop shell + local sidecar
  - desktop shell + `lobster-src` compatibility work
- `CONFIGURATION.md` now recommends staged setup for:
  - LLM provider configuration
  - publish and webhook flows
  - desktop runtime features
  - LobsterAI integration work
- Documentation now more clearly separates Node, Python, Rust, and Lobster runtime expectations to reduce setup friction.

### LobsterAI Sync

- Local bundled `lobster-src` has been upgraded from `v0.2.3` to `v0.2.4`.
- Upstream sync now includes:
  - IM bridge connectivity-test related fixes
  - WeCom-related improvements
  - bundled QQ bot support
  - startup loading-state fix from upstream `v0.2.4`

### Multi-language and App Packaging

- Top-level interface language switching and first-launch language selection remain part of the current workspace experience.
- Newly packaged apps in the current workspace set include:
  - Recruiting Desk
  - Project Ops Board
  - Deep Research Hub
  - Financial Document Bot
  - Social Media Auto-pilot
  - Website SEO Studio
  - Morning Brief
  - Meeting Copilot
  - Personal CRM
  - Inbox Declutter
  - Support Copilot
  - Second Brain
  - Email Assistant
  - Deal Desk
  - Family Calendar
  - Habit Tracker
  - Health Tracker
  - Creator Radar
  - Content Repurposer
  - Tech News Digest
  - Language Learning Desk

### Fixes

- Fixed Dock statistics in the desktop overview so Dock-only apps are counted correctly.
- Fixed custom workspace behavior so clearing all Desktop or Dock entries does not unexpectedly restore defaults.
- Fixed Agent sidebar async reply routing so switching sessions mid-request no longer pollutes another session's history.
- Type-check / build verification is now stable under the current Next-managed TypeScript configuration.

## v0.2.0-alpha.1 - 2026-03-11

- Desktop UX: window resize + keyboard tiling/restore shortcuts
- Spotlight: local recent apps/commands + `?` help actions
- Playbooks: local-first SOP library (save/export/import)
- Solutions Hub: curated workflow packs installable as Playbooks
- Publisher: queued dispatch with basic retry/backoff (while Publisher is open)
