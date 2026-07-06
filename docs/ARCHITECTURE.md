# Architecture

Last updated: 2026-07-06

## Current Architecture Direction

AgentCore OS is now organized around a **Controlled Skill / Playbook Runtime**.

The desktop shell and app windows remain useful, but they are no longer the architectural center. The core system is the runtime that executes fixed playbooks with explicit tool boundaries, human approval gates, durable trace records, recovery paths, and asset writeback.

For the full project frame, read:

- [Project Framework](PROJECT_FRAMEWORK.zh-CN.md)
- [Controlled Agent Runtime Development Manual](CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
- [Next Steps](NEXT_STEPS.md)
- [Governed Trace Operational Runbook](GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)

## High-Level Runtime Stack

```text
User / Trigger
  -> Playbook Resolver
  -> Plan Validator
  -> Runtime State Machine
  -> Step Runner
  -> Tool Gateway
  -> Approval Gate
  -> Trace Store
  -> Asset / Memory Writeback
  -> Runtime Console
```

## Core Runtime Modules

### Playbooks

Primary files:

- `src/lib/executor/playbooks/types.ts`
- `src/lib/executor/playbooks/catalog.ts`
- `src/lib/executor/playbooks/resolver.ts`
- `src/lib/executor/playbooks/validator.ts`
- `src/lib/executor/playbooks/sales-pipeline.ts`
- `src/lib/executor/playbooks/support-resolution.ts`

Responsibilities:

- define fixed workflow steps,
- declare input / output schemas,
- declare allowed tools,
- declare approval requirements,
- declare writeback targets,
- provide stable execution plans for controlled runs.

Current controlled paths:

- `sales-pipeline-v1`
- `support-resolution-v1`

### Executor Core

Primary files:

- `src/lib/executor/contracts.ts`
- `src/lib/executor/core.ts`
- `src/lib/executor/step-executor.ts`
- `src/lib/executor/guardrails.ts`
- `src/lib/executor/logger.ts`

Responsibilities:

- execute validated plans,
- enforce tool and approval boundaries,
- validate controlled step outputs,
- track step attempts,
- record step results and failures.

The model can generate content inside a step. It must not decide the authoritative step order for controlled playbooks.

### Runtime State

Primary files:

- `src/lib/executor/runtime/types.ts`
- `src/lib/server/controlled-execution-store.ts`
- `src/lib/executor/runtime/resume.ts`
- `src/lib/executor/runtime/writeback.ts`
- `src/lib/executor/runtime/console-summary.ts`
- `src/lib/executor/runtime/trace-governance.ts`
- `src/lib/executor/runtime/trace-fixtures.ts`
- `src/lib/executor/runtime/trace-replay.ts`

Responsibilities:

- persist controlled execution runs,
- persist approval records,
- support resume / recovery,
- write approved outputs into assets,
- summarize recent runs for Runtime Console,
- build governed trace artifacts,
- build and validate governed trace fixtures,
- replay committed fixtures against current playbook metadata without side effects.

### APIs

Primary routes:

- `POST /api/agent/stream`
- `POST /api/agent/approve`
- `GET /api/runtime/executor/controlled-runs`
- `GET /api/runtime/executor/controlled-runs/[runId]`
- `POST /api/runtime/executor/controlled-runs/[runId]/resume`
- `POST /api/runtime/executor/controlled-runs/[runId]/retry`
- `GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact`

Rules:

- API routes are facades over runtime state and executor core.
- They must not introduce separate execution semantics.
- Runtime state is the source of truth for controlled execution continuity.

### Runtime Console

Primary file:

- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`

Responsibilities:

- show recent controlled runs,
- show selected run trace,
- show approval state and schema state,
- approve / reject pending steps,
- resume non-terminal runs,
- retry eligible failed runs,
- show asset landing metadata,
- open Deal Desk / Support Copilot / Knowledge Vault / Industry Hub / Publisher from successful asset landings,
- copy governed trace artifacts through the local trace artifact route.

The console is an operations surface, not a decorative dashboard.

## UI And App Layer

The UI still uses the existing desktop-window architecture:

- Next.js App Router UI: `src/app`
- App registry: `src/apps/registry.ts`, `src/apps/types.ts`
- Window shell: `src/components/windows/AppWindowShell.tsx`
- Window state: `src/stores/window-store.ts`
- Shared UI events: `src/lib/ui-events.ts`

Architectural rule:

**Apps are business surfaces. Runtime state is not owned by app component state.**

For example:

- Deal Desk can display and continue sales work.
- Support Copilot can display and continue support work.
- Knowledge Vault can display retained knowledge.
- Runtime Console owns controlled run operation and trace review.

## State Model

State is split into four classes:

- UI transient state: window geometry, active window, onboarding flags.
- Local-first working cache: device-level preferences and light workbench data.
- Durable domain state: deals, support tickets, assets, workflow runs.
- Execution and audit state: controlled runs, approvals, trace, publish jobs, executor sessions.

Execution and audit state must be durable and inspectable. It must not live only in browser local state.

See:

- [State Inventory](STATE_INVENTORY.zh-CN.md)
- [ADR-003 Durable State Partitioning](adr/ADR-003-DURABLE_STATE_PARTITIONING.zh-CN.md)

## Asset Writeback

Controlled writeback currently supports:

- `sales_asset`
- `support_asset`
- `knowledge_asset`
- `workflow_run`
- `draft`

Writeback rules:

- approved output can be written,
- rejected or unapproved output is skipped,
- successful receipts include structured `assetId`, `sourceKey`, and `workflowRunId` when available,
- repeated resume / writeback paths should update existing records instead of creating duplicates,
- unsupported future targets must remain explicit skipped receipts until wired to a server-backed store.

## Governed Trace And Fixture Replay

Current governed trace capabilities:

- export-safe governed trace artifacts redact raw step input/output, tool output, approval feedback, audit messages, and free-form errors,
- Runtime Console copies governed artifacts instead of raw run records,
- committed sales/support governed fixtures validate current playbook metadata,
- fixture replay is pure metadata validation: no LLM calls, no tool execution, no API route calls, no store mutation, and no asset writes,
- `npm run trace:fixtures` is the machine-readable fixture catalog health gate,
- `npm run trace:fixtures:summary` is the human-readable triage view,
- `npm run trace:fixture:build -- <artifact.json>` converts one governed artifact into fixture JSON on stdout for manual review.

Real replay is not implemented. Future real replay work must first define sandbox, credential, approval simulation, store isolation, side-effect blocking, and replay result ownership boundaries.

## Compatibility Layers

Legacy OpenClaw and desktop sidecar paths remain compatibility surfaces.

Rules:

- External runtimes are adapters, not control planes.
- Compatibility routes should converge on AgentCore executor contracts.
- New execution behavior must not bypass controlled runtime rules.

See:

- [Executor Convergence](EXECUTOR_CONVERGENCE.zh-CN.md)

## Verification Gates

Runtime changes should normally pass:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Docs-only changes should at least pass:

```bash
git diff --check
```
