# Playbook Lifecycle Mutation Approval Gate Design

## Goal

Add one local read-only approval receipt gate after lifecycle maintenance readiness and before any real playbook lifecycle mutation. The gate makes human approval explicit and machine-checkable without executing migrations or changing registered playbooks.

## Context

The current lifecycle maintenance chain now covers:

- proposal intake;
- migration plan validation;
- ordered maintenance sequence declaration;
- recorded sequence evidence;
- evidence freshness/provenance;
- doctor triage;
- maintenance readiness aggregation.

The next gap is the approval boundary. A maintainer can see that readiness is green, but the project does not yet have a structured receipt proving who approved lifecycle mutation to proceed and what boundaries remain in force.

## Design

Add:

```bash
npm run playbook:lifecycle:mutation:approval:check -- --approval <path>
```

The approval receipt JSON will include:

- `approvalId`;
- `evidencePath`;
- `approver`;
- `approvedAt`;
- `decision: "approved"`;
- `approvalScope: "playbook_lifecycle_mutation"`;
- an embedded readiness summary proving the approver reviewed `playbook:lifecycle:maintenance:ready`;
- `mutationBoundary` flags proving no execution, fixture refresh, store write, external write, or publishing has already happened.

The gate will:

- require `--approval <path>`;
- support `--now <iso-or-date>`, `--current-commit <commit>`, and `--compact`;
- read one local approval JSON file;
- re-run the existing maintenance readiness helper in-process using `approval.evidencePath`;
- fail closed unless the current readiness report is green;
- fail closed unless the embedded readiness summary preserves `ready_for_lifecycle_maintenance`, `productionReady: false`, `publishingPerformed: false`, and `readinessOnly: true`;
- fail closed unless mutation boundary fields preserve no execution, no fixture refresh, no store writes, no external writes, and no publishing;
- emit machine-readable JSON with `approvedForLifecycleMutation`, `status`, `checks`, `findings`, `nextCommand`, and `nextAction`.

Status mapping:

- `approved_for_lifecycle_mutation`: approval receipt is valid and current readiness is green;
- `approval_not_valid`: approval receipt shape or decision is invalid;
- `readiness_not_green`: current readiness is not green;
- `mutation_boundary_breached`: approval receipt says mutation, fixture refresh, store write, external write, or publishing already happened.

## Boundaries

No migration execution, no registered playbook mutation, no fixture refresh, no store writes, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This gate only validates approval evidence and current readiness. It does not grant runtime permissions by itself.
