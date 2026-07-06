# Release Handoff Snapshot Validation Design

Date: 2026-07-07

## Context

AgentCore OS now has:

- `npm run release:handoff:check` for the full local handoff gate;
- `npm run release:handoff:snapshot` for writing local handoff evidence under
  `output/release-handoff/`;
- retry timing stability coverage for the server-backed retry regression that
  previously caused one transient handoff gate failure.

The next gap is evidence review. A maintainer can generate a snapshot, but a
reviewer still has to inspect the JSON manually to confirm:

- it is a release handoff evidence snapshot;
- it came from `release:handoff:check`;
- it preserves `productionReady: false`;
- it preserves `publishingPerformed: false`;
- it is marked `evidenceOnly: true`;
- it does not expose a successful release claim when the embedded handoff gate
  failed.

This should be a local read-only validation command, not a publication step.

## Goal

Add a local snapshot validation command:

```bash
npm run release:handoff:snapshot:check -- <snapshot.json>
```

The command should read one local JSON evidence file, validate its structure and
release boundary, and print a machine-readable JSON report.

The command must keep:

```json
{
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

It must not mutate the snapshot file or perform any external action.

## Non-Goals

- No publishing.
- No upload.
- No git push.
- No tag creation.
- No GitHub Release creation.
- No package or installer build.
- No browser automation.
- No dev server startup.
- No modification of files under `output/release-handoff/`.
- No validation of git history or remote repository state.
- No cryptographic signing or checksum registry.
- No production readiness claim.

## Command Contract

Script path:

```text
scripts/release-handoff/check-release-handoff-snapshot.mjs
```

Package script:

```json
"release:handoff:snapshot:check": "node scripts/release-handoff/check-release-handoff-snapshot.mjs"
```

Usage:

```bash
npm run release:handoff:snapshot:check -- output/release-handoff/release-handoff-2026-07-06T165302554Z.json
```

The first implementation requires an explicit file path. It does not need a
`--latest` helper, directory scan, or glob support.

## Validation Rules

Required top-level fields:

- `schemaVersion === 1`
- `kind === "release_handoff_evidence_snapshot"`
- `command === "release:handoff:snapshot"`
- `sourceCommand === "release:handoff:check"`
- `createdAt` is a non-empty string
- `ok` is boolean
- `productionReady === false`
- `publishingPerformed === false`
- `evidenceOnly === true`
- `git` is an object
- `handoffReport` is an object

Required `git` fields:

- `branch` is a string;
- `commit` is a string;
- `dirty` is boolean;
- `hasTrackedChanges` is boolean;
- `hasUntrackedFiles` is boolean;
- `statusShort` is an array.

Required `handoffReport` fields:

- `command === "release:handoff:check"`
- `ok` is boolean
- `productionReady === false`
- `publishingPerformed === false`
- `checks` is an array

Successful snapshot rules:

- if snapshot `ok === true`, `releaseClaim` must be
  `"local_release_handoff_ready"`;
- if snapshot `ok === true`, `handoffReport.releaseClaim` must also be
  `"local_release_handoff_ready"`;
- if snapshot `ok === true`, `handoffReport.ok` must be `true`.

Failed snapshot rules:

- if snapshot `ok === false`, top-level `releaseClaim` must be absent;
- if snapshot `ok === false`, `handoffReport.ok` must be `false`.

The validator should fail closed if any rule fails.

## Output Contract

On success:

```json
{
  "ok": true,
  "command": "release:handoff:snapshot:check",
  "snapshotPath": "output/release-handoff/release-handoff-2026-07-06T165302554Z.json",
  "snapshotOk": true,
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true,
  "checkedRules": [
    "top_level_shape",
    "git_context_shape",
    "handoff_report_shape",
    "release_boundary"
  ]
}
```

On validation failure:

- stdout still prints JSON;
- `ok` is `false`;
- `productionReady` remains `false`;
- `publishingPerformed` remains `false`;
- `evidenceOnly` remains `true`;
- `failures` lists stable machine-readable rule messages;
- process exit code is `1`.

If the file cannot be read or is invalid JSON, the command may print a concise
stderr error and exit non-zero without a normal validation report.

## Testing

Add:

```text
src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts
```

Required coverage:

- valid successful snapshot passes and reports the local release claim;
- valid failed snapshot passes validation but exits `1` because the embedded
  handoff failed;
- missing production boundary fails validation;
- failed snapshot with a top-level `releaseClaim` fails validation;
- invalid JSON throws a clear error without pretending validation ran.

Add the new test file to:

```text
npm run test:controlled-runtime
```

## Documentation Updates

Update:

- `CHANGELOG.md`
- `README.md`
- `docs/NEXT_STEPS.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `memory/2026-07-07.md`

Docs must say:

- snapshot validation is local and read-only;
- it checks schema and release boundary;
- it does not publish, upload, tag, package, or modify evidence files;
- generated evidence under `output/release-handoff/` still should not be
  committed by default.

## Verification

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts
npm run release:handoff:snapshot
npm run release:handoff:snapshot:check -- <generated-snapshot-path>
npm run release:handoff:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Do not stage generated evidence under `output/release-handoff/`.

## Acceptance Criteria

- Snapshot validation has a local npm command.
- Valid successful snapshots pass with `releaseClaim:
  "local_release_handoff_ready"`.
- Valid failed snapshots are accepted as evidence but return a non-zero command
  status and expose no successful release claim.
- Boundary violations fail closed with machine-readable failures.
- The command is read-only and does not mutate evidence files.
- Docs and memory logs describe the validator and non-publication boundary.

## Spec Self-Review

- Placeholder scan: no placeholders remain.
- Scope check: one local read-only validator, one test file, npm script, docs.
- Boundary check: no publishing, uploading, tagging, package build, UI, browser,
  or production readiness claim.
- Ambiguity check: valid failed snapshots validate structurally but cause a
  non-zero CLI exit because the embedded handoff did not pass.
