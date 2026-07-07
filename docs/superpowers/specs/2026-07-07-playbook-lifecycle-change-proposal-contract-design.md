# Playbook Lifecycle Change Proposal Contract Design

## Goal

Add a local read-only contract for proposed playbook lifecycle changes before authoring, version updates, or deprecation work begins.

## Context

The runtime now has:

- `playbook:control:audit` for registered playbook contract, lifecycle, guardrail, and fixture coverage;
- `playbook:lifecycle:review` for review due/overdue diagnostics;
- `playbook:lifecycle:handoff` for local version/deprecation handoff readiness.

The remaining lifecycle gap is the change intake itself. Maintainers can see whether the current catalog is healthy, but there is not yet a structured proposal contract for a new playbook, a version update, or a deprecation handoff. Without that contract, lifecycle changes can still start from ad hoc edits.

## Design

Add `npm run playbook:lifecycle:change:check -- --proposal <path>`.

The proposal checker will validate a JSON file with:

- `proposalId`;
- `changeType`: `new_playbook`, `version_update`, or `deprecation`;
- `playbookId`;
- `owner`;
- `reason`;
- `specPath`;
- `planPath`;
- `requiredCommands`;
- `expectedFixtureIds`;
- `riskNotes`.

Validation rules:

- all string identifiers and rationale fields must be non-empty;
- `changeType` must be one of the allowed values;
- `specPath` and `planPath` must point to existing local files;
- `requiredCommands` must include:
  - `npm run playbook:control:audit`;
  - `npm run playbook:lifecycle:handoff`;
  - `npm run trace:fixtures --silent`;
  - `npm run test:controlled-runtime`;
- `expectedFixtureIds` must be non-empty for `new_playbook` and `version_update`;
- `deprecation` proposals must include `replacementPlaybookId` and `deprecatedAt`;
- the command must emit machine-readable JSON with `productionReady: false`, `publishingPerformed: false`, and `proposalOnly: true`.

Add a tracked example proposal under `docs/playbook-lifecycle-change-proposals/` so maintainers have a copyable local contract example. The example is documentation/test input only and must not trigger a real playbook migration.

## Boundaries

No UI, no authoring screen, no playbook mutation, no migration runner, no fixture mutation, no runtime execution, no tool execution, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This is a proposal contract only. It does not approve the change; it only makes the intake checklist explicit and locally auditable.
