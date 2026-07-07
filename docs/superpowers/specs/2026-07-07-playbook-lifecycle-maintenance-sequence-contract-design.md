# Playbook Lifecycle Maintenance Sequence Contract Design

## Goal

Add a local read-only checker for the ordered playbook lifecycle maintenance sequence, after proposal and migration-plan contracts exist but before any registered playbook, fixture, store, or external system is changed.

## Context

The current lifecycle path has separate gates:

- `playbook:lifecycle:change:check` validates structured lifecycle change proposals;
- `playbook:lifecycle:migration:plan:check` validates linked migration plans;
- `playbook:lifecycle:handoff` checks current catalog lifecycle handoff readiness;
- `trace:fixtures --silent` checks governed fixture replay health;
- `test:controlled-runtime` runs the controlled runtime regression suite.

The gap is the ordered maintenance sequence. A proposal and plan can each be valid while the operator path is still ambiguous. The project needs a machine-checkable sequence contract that states the required gates in order, ties proposal and plan paths together, records the expected no-mutation boundary, and keeps future maintainers from skipping fixture or runtime verification before a lifecycle change.

## Design

Add `npm run playbook:lifecycle:sequence:check -- --sequence <path>`.

The sequence checker will validate a JSON file with:

- `sequenceId`;
- `owner`;
- `proposalPath`;
- `migrationPlanPath`;
- `orderedCommands`;
- `handoffExpectation`;
- `fixtureExpectation`;
- `runtimeTestExpectation`;
- `mutationPolicy`;
- `publishingPolicy`.

Validation rules:

- required identifier, owner, and path fields must be non-empty;
- `proposalPath` and `migrationPlanPath` must reference valid local JSON inputs;
- the proposal must pass existing `playbook:lifecycle:change:check` semantics;
- the migration plan must pass existing `playbook:lifecycle:migration:plan:check` semantics;
- the migration plan `proposalPath` must match the sequence `proposalPath`;
- `orderedCommands` must appear in this exact order:
  - `npm run playbook:lifecycle:change:check -- --proposal <proposalPath>`;
  - `npm run playbook:lifecycle:migration:plan:check -- --plan <migrationPlanPath>`;
  - `npm run playbook:lifecycle:handoff`;
  - `npm run trace:fixtures --silent`;
  - `npm run test:controlled-runtime`;
- `handoffExpectation` must be `ready_for_lifecycle_handoff`;
- `fixtureExpectation` must be `governed_fixtures_green`;
- `runtimeTestExpectation` must be `controlled_runtime_green`;
- `mutationPolicy` must be `no_mutation_until_sequence_green`;
- `publishingPolicy` must be `no_publish_or_release`;
- output must include `productionReady: false`, `publishingPerformed: false`, and `sequenceOnly: true`.

Add a tracked example sequence under `docs/playbook-lifecycle-maintenance-sequences/` that references the existing example proposal and migration plan. The example is documentation/test input only.

## Boundaries

No command runner, no UI, no authoring screen, no registered playbook mutation, no migration execution, no fixture mutation, no runtime execution, no tool execution, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This is a maintenance sequence contract only. It does not prove the declared commands were executed; it proves the lifecycle maintenance workflow is explicit, ordered, linked, and still inside the no-mutation/no-publishing boundary.
