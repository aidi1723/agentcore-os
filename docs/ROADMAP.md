# Roadmap

Last updated: 2026-07-06

This roadmap tracks the current post-`v1.3.0` engineering direction.

The project should not grow by adding more standalone apps in the near term. The priority is making AgentCore OS a reliable **Controlled Skill / Playbook Runtime** with governed trace and replay boundaries.

## North Star

AgentCore OS should execute fixed business playbooks with:

- deterministic steps,
- explicit input / output schemas,
- restricted tools,
- human approval gates,
- durable trace,
- resumable and retryable controlled runs,
- structured asset writeback,
- Runtime Console operations,
- governed trace artifacts,
- fixture replay gates before any real replay.

## Current Completed Baseline

Completed in the current controlled runtime line:

- `sales-pipeline-v1` fixed playbook.
- `support-resolution-v1` fixed playbook.
- Playbook resolver / validator / schema validation.
- Durable controlled execution records.
- Durable approval records.
- Resume route and client recovery for stream loss / approval races.
- Runtime Console trace landing, filtering, search, approve, reject, resume, and retry.
- Failed-step retry eligibility and console-initiated recovery audit events.
- Server-backed writeback for `sales_asset`, `support_asset`, `knowledge_asset`, `workflow_run`, and `draft`.
- Runtime Console asset landings and exact record focus for sales, support, knowledge, workflow runs, and drafts.
- Governed trace artifact builder and local trace artifact route.
- Runtime Console governed trace copy action.
- Conservative terminal-run prune helper.
- Governed trace fixture builder, validator, committed sales/support fixtures, pure fixture replay runner, fixture catalog, catalog report, JSON summary command, human-readable summary command, failure harness, and fixture builder CLI.
- Fixture refresh workflow, replay contract, failure fixture matrix, refresh review checklist, CI gate guide, catalog coverage guide, and governed trace operational runbook.

Current fixture replay remains metadata-only. It does not call LLMs, execute tools, call API routes, mutate stores, or write assets.

## Near-Term Roadmap

### P0. Real Replay Boundary Design

Completed boundary reference:

- [Real Replay Boundary Design](REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md)

The guide defines the boundary before any real replay code:

- replay sandbox ownership,
- credential isolation,
- approval simulation,
- store isolation,
- side-effect blocking,
- replay result artifact ownership,
- failure and audit semantics,
- relationship between governed artifacts, committed fixtures, and future replay runs.

Expected outcome:

- a design document and implementation plan for real replay boundaries,
- explicit stop conditions for unsafe replay inputs,
- no LLM/tool replay implementation yet.

### P1. Replay Sandbox Contract Types

Completed contract reference:

- `src/lib/executor/runtime/replay-sandbox-contracts.ts`
- `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`

Before building a prototype, the project now has TypeScript-only contracts for:

- replay input provenance,
- sandbox context,
- credential policy,
- approval simulation,
- store isolation,
- side-effect policy,
- replay result artifacts.

This phase must still avoid LLM replay, tool execution, route calls, store
reads/writes, and asset writes.

### P2. No-Side-Effect Replay Sandbox Prototype Design

Before implementation, design the smallest prototype that:

- accepts only a validated replay sandbox contract,
- fails before execution for unsafe contracts,
- emits only a replay result artifact,
- keeps runtime stores and business assets out of scope.

### P3. No-Side-Effect Replay Sandbox Prototype

Only after P0, P1, and P2 are accepted, build the smallest no-side-effect prototype:

- no production credentials,
- no store writes,
- no asset writes,
- no hidden API side effects,
- approval simulation only,
- replay results written to replay artifacts, not business assets.

### P4. Governed Fixture And Playbook Expansion

Expand only when the current governed trace/replay gates stay stable:

- add fixture JSON when a new playbook, writeback target family, terminal state, or real contract gap requires it,
- add new controlled playbooks only through spec -> plan -> tests -> fixture/replay gates,
- do not use fixture expansion as a substitute for real replay boundary design.

### P5. Trace Operations Hardening

Turn the governed trace operational runbook into a tighter maintenance path:

- raw trace retention discipline,
- fixture refresh stop-condition enforcement,
- catalog failure triage,
- summary/harness drift checks,
- clearer handoff records for fixture replacement.

### P6. Runtime-Supporting UI And App Polish

Polish UI only when it serves runtime operation:

- clearer run state,
- clearer approval and failure handling,
- clearer trace export and fixture maintenance affordances,
- better asset landing inspection.

Do not add decorative OS-shell surface area or unrelated app windows.

## Later Roadmap

After real replay boundaries are designed and the no-side-effect prototype is proven:

- creator/content controlled playbook migration,
- stronger retrieval and Knowledge Vault reuse inside controlled playbook boundaries,
- connector hardening tied to explicit tool gateway policies,
- desktop sidecar parity cleanup where it supports runtime operation,
- accessibility and keyboard navigation pass for Runtime Console workflows.

## Deprioritized Until Runtime Stabilizes

- more standalone apps,
- generic plugin marketplace,
- generic skill collection work,
- open-ended multi-agent orchestration,
- decorative OS-shell UI expansion,
- broad admin SaaS features,
- model-provider work not tied to controlled execution,
- real tool replay before sandbox/credential/store/side-effect boundaries are designed.
