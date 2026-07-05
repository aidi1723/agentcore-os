# Roadmap

Last updated: 2026-07-05

This roadmap tracks the current post-`v1.3.0` engineering direction.

The project should not grow by adding more standalone apps in the near term. The priority is making AgentCore OS a reliable **Controlled Skill / Playbook Runtime**.

## North Star

AgentCore OS should execute fixed business playbooks with:

- deterministic steps,
- explicit input / output schemas,
- restricted tools,
- human approval gates,
- durable trace,
- resumable execution,
- structured asset writeback,
- Runtime Console operations.

## Current Completed Baseline

The first controlled path is `sales-pipeline-v1`.

Already completed:

- fixed playbook resolver / validator,
- controlled execution records,
- durable approval records,
- resume route,
- client recovery for interrupted streams,
- approved writeback into sales and knowledge assets,
- Runtime Console trace landing,
- Runtime Console approve / reject / resume,
- Runtime Console asset metadata search and open actions.

## Near-Term Roadmap

### P0. Runtime Console Failure Recovery

Add failed-step recovery controls:

- failed step detail,
- retry eligibility,
- retry / restart action,
- console recovery audit metadata,
- regression coverage for retry safety.

### P1. Record-Level Asset Focus

Make asset deep links more precise:

- open Deal Desk with the written sales asset selected,
- open Knowledge Vault with the written knowledge asset selected,
- preserve workflow context while focusing the asset,
- keep historical receipt compatibility.

### P2. Complete Writeback Targets

Wire currently skipped targets:

- `workflow_run`
- `draft`

Expected outcome:

- controlled runs can update workflow state and draft assets with real receipts.

### P3. Support Playbook Migration

Create a controlled support workflow:

- intake,
- classify,
- draft reply,
- human review,
- writeback support asset / knowledge asset.

### P4. Trace Governance

Harden trace as an operational asset:

- redaction,
- retention policy,
- export,
- replay support,
- trace-to-test fixture generation.

## Later Roadmap

After controlled runtime stabilizes:

- creator/content playbook migration,
- stronger retrieval and Knowledge Vault reuse,
- connector hardening,
- desktop sidecar parity cleanup,
- accessibility and keyboard navigation pass.

## Deprioritized Until Runtime Stabilizes

- more standalone apps,
- generic plugin marketplace,
- open-ended multi-agent orchestration,
- decorative OS-shell UI expansion,
- broad admin SaaS features,
- model-provider work not tied to controlled execution.
