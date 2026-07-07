# Playbook Lifecycle Mutation Preflight Gate Design

## Goal

Start Productionization Preparation with a local read-only preflight gate before any real playbook lifecycle mutation executor is implemented or run.

The gate answers one question: is the current lifecycle mutation package ready for a manual mutation executor implementation review?

## Contract

The command is:

```bash
npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>
```

It aggregates:

- project closeout readiness
- lifecycle mutation dry-run readiness
- approval status embedded in the dry-run report
- dry-run target scope and operation intent
- dry-run execution boundary

## Required Green State

The gate exits 0 only when:

- `project:closeout:check` is green;
- `playbook:lifecycle:mutation:dry-run:check` is green;
- dry-run approval is green;
- at least one planned target is `registered_playbook_contract` with `operation: "update_contract"`;
- all target paths remain under `src/lib/executor/playbooks/`;
- dry-run execution boundary still has no mutation, no fixture refresh, no store writes, no external writes, no publishing, and no production readiness.

## Boundary

The gate keeps:

- `productionReady: false`
- `publishingPerformed: false`
- `preflightOnly: true`

It does not mutate registered playbooks, refresh fixtures, write stores, call external connectors, publish, tag, upload artifacts, package installers, run browser smoke, or claim production readiness.
