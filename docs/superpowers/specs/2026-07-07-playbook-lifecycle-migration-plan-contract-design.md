# Playbook Lifecycle Migration Plan Contract Design

## Goal

Add a local read-only checker for playbook lifecycle migration plans, after a lifecycle change proposal is valid but before any registered playbook, fixture, store, or external system is changed.

## Context

The current lifecycle path has:

- `playbook:lifecycle:change:check` for structured change proposal intake;
- `playbook:lifecycle:handoff` for current registered catalog handoff readiness;
- `playbook:control:audit`, `playbook:lifecycle:review`, and fixture replay commands as local contract gates.

The next gap is the migration plan itself. A proposal can be valid while the actual migration path is still vague. The project needs a machine-checkable plan contract that forces maintainers to state source/target playbooks, planned changes, rollback notes, verification commands, and the linked proposal before any mutation begins.

## Design

Add `npm run playbook:lifecycle:migration:plan:check -- --plan <path>`.

The migration plan checker will validate a JSON file with:

- `planId`;
- `proposalPath`;
- `migrationType`: `new_playbook`, `version_update`, or `deprecation`;
- `fromPlaybookId`;
- `toPlaybookId`;
- `owner`;
- `plannedChanges`;
- `rollbackPlan`;
- `requiredCommands`;
- `fixtureReview`;
- `mutationPolicy`.

Validation rules:

- all identifier, owner, and rationale fields must be non-empty;
- `migrationType` must be one of the allowed values;
- `proposalPath` must point to an existing JSON proposal;
- the referenced proposal must pass `playbook:lifecycle:change:check` semantics;
- `migrationType` and `toPlaybookId` must match the referenced proposal;
- `plannedChanges` and `rollbackPlan` must be non-empty arrays of strings;
- `requiredCommands` must include:
  - `npm run playbook:lifecycle:change:check -- --proposal <proposalPath>`;
  - `npm run playbook:lifecycle:handoff`;
  - `npm run trace:fixtures --silent`;
  - `npm run test:controlled-runtime`;
- `fixtureReview.expectedFixtureIds` must be non-empty for `new_playbook` and `version_update`;
- `mutationPolicy` must be `no_mutation_until_plan_approved`;
- output must include `productionReady: false`, `publishingPerformed: false`, and `planOnly: true`.

Add a tracked example plan under `docs/playbook-lifecycle-migration-plans/` that references the existing example proposal. The example is documentation/test input only.

## Boundaries

No UI, no authoring screen, no registered playbook mutation, no migration runner, no fixture mutation, no runtime execution, no tool execution, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This is a migration planning contract only. It does not approve, execute, or apply a migration.
