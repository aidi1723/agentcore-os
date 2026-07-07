# Project Closeout Readiness Gate Design

## Goal

Add a final local read-only closeout gate for the current Controlled Skill / Playbook Runtime milestone.

The gate answers one narrow question: can the current controlled-runtime milestone be closed locally without claiming production readiness?

## Contract

The command is:

```bash
npm run project:closeout:check -- --evidence <path> --dry-run <path>
```

It aggregates these existing gates:

- `playbook:control:audit`
- `playbook:lifecycle:maintenance:ready`
- `playbook:lifecycle:mutation:dry-run:check`
- `delivery:ready:check`

It exits 0 only when all required gates are green and none of them claims production readiness or publishing.

## Output

The report is machine-readable JSON and always includes:

- `productionReady: false`
- `publishingPerformed: false`
- `closeoutOnly: true`
- `readyForCurrentMilestoneCloseout`
- required gate summaries
- `closedForCurrentMilestone`
- `deferredNextPhase`
- fail-closed findings

## Deferred Next Phase

The gate must explicitly defer:

- real mutation executor
- authoring/versioning/deprecation UI
- unified policy/guardrail layer
- deeper real replay
- external connector writeback
- production operations

## Boundaries

The gate does not execute migrations, mutate registered playbooks, refresh fixtures, write stores, call external connectors, publish, tag, upload artifacts, package installers, run browser smoke, or claim production readiness.
