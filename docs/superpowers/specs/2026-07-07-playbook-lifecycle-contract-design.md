# Playbook Lifecycle Contract Design

## Goal

Add explicit lifecycle metadata to every registered controlled playbook and make `playbook:control:audit` fail closed when lifecycle ownership or review policy is missing.

## Context

The runtime can now execute, audit, and guardrail-check registered playbooks. The remaining design gap is lifecycle management: maintainers need to know whether a playbook is active, who owns it, when it was last reviewed, how often it must be reviewed, and which change policy governs updates.

This phase adds the smallest useful lifecycle contract without adding a UI, authoring workflow, release action, or runtime behavior change.

## Design

Add `lifecycle` to `ControlledPlaybook`:

- `status`: `active`, `experimental`, or `deprecated`;
- `owner`: non-empty maintainer or team string;
- `lastReviewedAt`: ISO date in `YYYY-MM-DD`;
- `reviewCadenceDays`: positive integer;
- `changePolicy`: currently fixed to `spec_plan_tdd_fixture_required`.

Enhance `playbook:control:audit`:

- include lifecycle metadata in each audit item;
- fail closed when lifecycle metadata is missing;
- fail closed when lifecycle fields are malformed;
- keep output local, machine-readable, and non-production.

## Boundaries

No runtime behavior change, no UI, no playbook authoring screen, no fixture mutation, no release, no browser smoke, no external connector writes.
