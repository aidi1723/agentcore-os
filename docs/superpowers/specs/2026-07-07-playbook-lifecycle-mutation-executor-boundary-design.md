# Playbook Lifecycle Mutation Executor Boundary Design

Date: 2026-07-07

## Goal

Add the first real local mutation executor boundary after lifecycle mutation preflight.

The executor must allow maintainers to preview and, only with explicit confirmation, apply manifest-declared registered playbook file replacements while preserving the project's controlled-runtime safety boundary.

## Scope

- Add a manifest contract for lifecycle mutation execution.
- Add preview mode that validates the manifest, fresh preflight report, dry-run-declared target scope, current file hash, and next content hash without writing files.
- Add apply mode that writes only scoped registered playbook targets and only when `--confirm-apply` is present.
- Keep fixture refresh, store writes, external connector writes, publishing, release tagging, artifact upload, and production-readiness claims out of scope.
- Add tests for stale hash rejection, path scope rejection, missing apply confirmation, and confirmed temp-fixture writes.

## Contract

The manifest must include:

- `manifestId`
- `dryRunPath`
- `targetPlaybookId`
- embedded green preflight metadata
- `targets[]` with `kind`, `path`, `operation`, `expectedCurrentSha256`, `nextContentSha256`, and `nextContent`
- `executionBoundary` confirming executor-only operation and no fixture/store/external/publishing/production side effects

The executor must also receive a fresh preflight report from:

```bash
npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>
```

The embedded manifest preflight is not trusted alone.

## Boundaries

- Allowed target path prefix: `src/lib/executor/playbooks/`
- Allowed target extension: `.ts`
- Allowed operation: `replace_file`
- Target path must be present in the approved dry-run `plannedTargets` set as an `update_contract` target
- Apply requires `--confirm-apply`
- Preview must never write
- Apply must keep `productionReady: false` and `publishingPerformed: false`
- Apply does not refresh fixtures; fixture review remains a later handoff

## Non-Goals

- Productized authoring UI
- Full playbook version migration workflow
- Fixture refresh automation
- Store mutation
- External connector writeback
- Release publishing
- Production operations
