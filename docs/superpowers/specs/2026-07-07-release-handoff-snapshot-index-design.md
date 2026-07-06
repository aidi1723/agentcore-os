# Release Handoff Snapshot Index Design

## Summary

Add a local read-only command that indexes release handoff evidence snapshots under `output/release-handoff/` and optionally validates each listed snapshot with the existing snapshot validator.

The command gives maintainers one machine-readable view of local handoff evidence after `npm run release:handoff:snapshot` has produced one or more JSON files. It does not create a new snapshot, mutate evidence, publish, upload, tag, package installers, create GitHub Releases, run browser smoke, or claim production readiness.

## Problem

The current release handoff path has three separate capabilities:

- `npm run release:handoff:check` proves the current local handoff gate.
- `npm run release:handoff:snapshot` writes one local evidence JSON file.
- `npm run release:handoff:snapshot:check -- <snapshot.json>` validates one evidence JSON file.

This is enough for a careful maintainer, but the local evidence directory can accumulate multiple timestamped files. A reviewer still has to find the newest file manually, run the validator manually, and decide whether older failed snapshots are relevant. The project needs a repeatable local index command before a public handoff or archive review.

## Goals

- Add `npm run release:handoff:snapshot:index`.
- Read local snapshot files from `output/release-handoff/` by default.
- Sort snapshots by `createdAt` descending, with filename fallback for malformed or missing timestamps.
- Support a `--limit <n>` option so maintainers can list the latest N snapshots.
- Support `--check` to validate each listed snapshot using `checkReleaseHandoffSnapshotFile()`.
- Emit machine-readable JSON with:
  - `ok`;
  - `command`;
  - `snapshotDir`;
  - `count`;
  - `snapshots`;
  - release boundary flags: `productionReady: false`, `publishingPerformed: false`, `evidenceOnly: true`.
- Preserve failed evidence snapshots as index entries. A failed snapshot can be structurally valid evidence, but the index exits non-zero when `--check` is enabled and any checked snapshot has a non-zero validation exit code.

## Non-Goals

- No publication, upload, tag creation, installer packaging, GitHub Release creation, or external write.
- No new evidence file creation.
- No evidence mutation or cleanup.
- No browser automation or screenshot evidence.
- No production-readiness claim.
- No changes to `release:handoff:check`, `release:handoff:snapshot`, or snapshot validation rules except through reuse.

## Command Contract

Default:

```bash
npm run release:handoff:snapshot:index
```

With validation:

```bash
npm run release:handoff:snapshot:index -- --check --limit 5
```

Optional directory override for tests and local operators:

```bash
npm run release:handoff:snapshot:index -- --dir output/release-handoff --check
```

Expected success report shape:

```json
{
  "ok": true,
  "command": "release:handoff:snapshot:index",
  "snapshotDir": "output/release-handoff",
  "count": 1,
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true,
  "checked": true,
  "snapshots": [
    {
      "path": "output/release-handoff/release-handoff-2026-07-06T170437942Z.json",
      "createdAt": "2026-07-06T17:04:37.942Z",
      "ok": true,
      "releaseClaim": "local_release_handoff_ready",
      "productionReady": false,
      "publishingPerformed": false,
      "evidenceOnly": true,
      "validation": {
        "ok": true,
        "exitCode": 0,
        "snapshotOk": true
      }
    }
  ]
}
```

## Validation Rules

When `--check` is omitted:

- The command only reads and parses JSON files.
- Invalid JSON files are included as failed entries.
- Exit code is `0` if directory listing succeeds, even if an individual file cannot be parsed, because no validation gate was requested.

When `--check` is present:

- Each listed file is passed to `checkReleaseHandoffSnapshotFile()`.
- A valid successful snapshot contributes `validation.exitCode: 0`.
- A structurally valid failed snapshot contributes `validation.ok: true`, `validation.exitCode: 1`, and keeps no top-level successful release claim.
- Invalid JSON, invalid schema, or boundary violation contributes `validation.ok: false`, `validation.exitCode: 1`, and an error/failure summary.
- Overall command exits `1` if any listed validation exit code is non-zero.

## Empty Directory Behavior

If the snapshot directory does not exist or contains no `.json` files, the command returns:

```json
{
  "ok": true,
  "command": "release:handoff:snapshot:index",
  "snapshotDir": "output/release-handoff",
  "count": 0,
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true,
  "checked": false,
  "snapshots": []
}
```

This is not a release-ready claim. It only means there is no local evidence to index.

## Architecture

Create `scripts/release-handoff/index-release-handoff-snapshots.mjs` as a focused Node ESM script.

Responsibilities:

- parse CLI flags;
- list `.json` files in the snapshot directory;
- read minimal snapshot metadata;
- sort and limit entries;
- optionally call the existing snapshot validator;
- print a JSON report and set the correct exit code.

The script should export pure helper functions for tests:

- `RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND`
- `parseReleaseHandoffSnapshotIndexArgs(argv)`
- `buildReleaseHandoffSnapshotIndex(options)`

`buildReleaseHandoffSnapshotIndex()` should accept injectable filesystem helpers so tests do not touch real `output/`.

## Testing

Add `src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts`.

Required coverage:

- indexes snapshots sorted newest first and respects `--limit`;
- validates listed snapshots when `check: true`;
- exits non-zero when checked entries include a failed or invalid snapshot;
- returns an empty successful report for a missing/empty directory;
- parses CLI flags for `--dir`, `--limit`, and `--check`.

Add the test file to `test:controlled-runtime`.

## Documentation

Update:

- `README.md`
- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `memory/2026-07-07.md`

Docs must say that `release:handoff:snapshot:index` is a local evidence review helper only. It does not publish, upload, tag, package installers, create GitHub Releases, mutate evidence, run browser smoke, or claim production readiness.

## Verification

Targeted:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-index-script.test.ts
```

Full:

```bash
npm run release:handoff:snapshot:index -- --check --limit 5
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

The existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` remains an accepted known warning unless a new lint/build error appears.
