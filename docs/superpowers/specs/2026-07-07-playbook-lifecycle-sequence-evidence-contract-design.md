# Playbook Lifecycle Sequence Evidence Contract Design

## Goal

Add a local read-only checker for playbook lifecycle sequence evidence, after a maintenance sequence contract is valid but before any registered playbook, fixture, store, or external system is changed.

## Context

The current lifecycle maintenance path can now declare the ordered workflow:

- proposal check;
- migration plan check;
- lifecycle handoff;
- governed fixture gate;
- controlled runtime regression.

The remaining gap is recorded evidence. A sequence can be valid while the actual command results are still missing, stale, or incorrectly claiming mutation/publishing. The project needs a machine-checkable evidence contract that validates recorded command outcomes and release-boundary fields without executing the commands itself.

## Design

Add `npm run playbook:lifecycle:sequence:evidence:check -- --evidence <path>`.

The evidence checker will validate a JSON file with:

- `evidenceId`;
- `sequencePath`;
- `owner`;
- `recordedAt`;
- `commandResults`;
- `mutationSummary`;
- `publishingSummary`;
- `approvalStatus`.

Validation rules:

- required identifier, owner, timestamp, and sequence path fields must be non-empty;
- `sequencePath` must reference a valid local maintenance sequence JSON;
- the referenced sequence must pass existing `playbook:lifecycle:sequence:check` semantics;
- `commandResults` must include exactly the commands declared by the sequence, in the same order;
- each command result must have `ok: true`, `exitCode: 0`, and a non-empty `recordedAt`;
- the sequence check command result must include `sequenceOnly: true`, `productionReady: false`, and `publishingPerformed: false`;
- the lifecycle handoff command result must include `handoffOnly: true`, `productionReady: false`, and `publishingPerformed: false`;
- the fixture command result must include `fixtureGate: "governed_fixtures_green"`;
- the controlled runtime command result must include positive `testFiles` and `tests` counts;
- `mutationSummary.performed` must be `false`;
- `publishingSummary.performed` must be `false`;
- `approvalStatus` must be `evidence_only`;
- output must include `productionReady: false`, `publishingPerformed: false`, and `evidenceOnly: true`.

Add a tracked example evidence file under `docs/playbook-lifecycle-sequence-evidence/` that references the existing example sequence. The example is documentation/test input only.

## Boundaries

No command execution, no UI, no authoring screen, no registered playbook mutation, no migration execution, no fixture mutation, no store writes, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This is an evidence contract only. It does not generate evidence and does not prove that the commands were run in this process; it checks that a recorded evidence file is structurally complete, ordered, linked, and still inside the no-mutation/no-publishing boundary.
