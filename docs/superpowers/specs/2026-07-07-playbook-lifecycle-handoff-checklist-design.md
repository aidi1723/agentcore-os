# Playbook Lifecycle Handoff Checklist Design

## Goal

Add a local read-only checklist command for playbook versioning and deprecation handoff readiness.

## Context

The runtime now has:

- `playbook:control:audit` for playbook contract, guardrail, fixture, lifecycle, and deprecated replacement validation;
- `playbook:lifecycle:review` for active playbook review due/overdue diagnostics.

The next maintenance gap is a single command that maintainers can run before a playbook version or deprecation handoff. It should not introduce new policy; it should aggregate existing gates and summarize whether the current registered catalog is locally ready for lifecycle handoff.

## Design

Add `npm run playbook:lifecycle:handoff`.

The command will:

- run the same local catalog inputs used by `playbook:control:audit`;
- run the same lifecycle review semantics used by `playbook:lifecycle:review`;
- report `readyForLifecycleHandoff`;
- include compact check status for control audit and lifecycle review;
- summarize registered playbook counts by active, experimental, and deprecated status;
- include deprecated replacement chains already declared in lifecycle metadata;
- fail closed when control audit is not green;
- fail closed when lifecycle review is not green;
- support `--now YYYY-MM-DD` and `--compact`;
- emit JSON with `productionReady: false`, `publishingPerformed: false`, and `handoffOnly: true`.

## Boundaries

No UI, no authoring screen, no migration runner, no fixture mutation, no runtime execution, no tool execution, no external connector writes, no release, no browser smoke, and no production-readiness claim.
