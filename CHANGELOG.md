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
- Verified `npm run test:controlled-runtime` — 24 files, 137 tests passing.
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
