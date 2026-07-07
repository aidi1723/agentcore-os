# Playbook Lifecycle Maintenance Readiness Gate Design

## Goal

Add one local read-only readiness gate before maintainers start any playbook lifecycle mutation. The gate aggregates the existing lifecycle handoff checklist and sequence evidence doctor so a maintainer can see whether current catalog state and evidence state are both ready.

## Context

The current lifecycle maintenance chain has focused gates for:

- catalog control audit and lifecycle review via `playbook:lifecycle:handoff`;
- recorded sequence evidence validation;
- sequence evidence freshness/provenance validation;
- sequence evidence doctor triage.

The remaining gap is the final local decision point. A maintainer still has to run the handoff and evidence doctor separately before deciding whether lifecycle maintenance can proceed. The next layer should aggregate these existing checks without creating a new source of truth.

## Design

Add:

```bash
npm run playbook:lifecycle:maintenance:ready -- --evidence <path>
```

The gate will:

- require `--evidence <path>`;
- support `--now <iso-or-date>`, `--current-commit <commit>`, and `--compact`;
- run the existing lifecycle handoff helper in-process;
- run the existing sequence evidence doctor helper in-process;
- set `readyForLifecycleMaintenance: true` only when handoff is green and evidence doctor status is `fresh_evidence`;
- emit machine-readable JSON with `nextCommand`, `nextAction`, and failure findings;
- exit `0` only when ready.

Status and failure mapping:

- `ready_for_lifecycle_maintenance`: handoff green and evidence fresh;
- `handoff_not_ready`: lifecycle handoff is not green;
- `evidence_not_ready`: sequence evidence doctor is not `fresh_evidence`;
- `maintenance_not_ready`: both checks are failing.

## Boundaries

No command execution from evidence, no evidence generation, no authoring UI, no registered playbook mutation, no migration execution, no fixture mutation, no store writes, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This gate only aggregates existing local checkers and recommends the next command; it does not run the suggested command.
