# Release Handoff Evidence Snapshot Design

Date: 2026-07-07

## Context

AgentCore OS now has a full local handoff gate:

```bash
npm run release:handoff:check
```

That gate aggregates repository hygiene, delivery readiness, controlled runtime
regression, core workflow regression, lint, build, and `git diff --check`. It
prints a machine-readable JSON report and keeps the boundary explicit:

```json
{
  "productionReady": false,
  "publishingPerformed": false
}
```

The remaining gap is evidence retention. After a maintainer runs the full local
handoff gate, the result exists only in terminal output unless it is copied
manually. For handoff review, maintainers need a repeatable local snapshot file
that records the gate result plus repository context without publishing,
tagging, uploading, or committing generated evidence.

## Goal

Add a local snapshot command:

```bash
npm run release:handoff:snapshot
```

The command should run `release:handoff:check`, parse its JSON output, collect
basic git context, and write a local-only JSON evidence file under:

```text
output/release-handoff/
```

The snapshot must preserve the current release boundary:

```json
{
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

On a successful handoff gate, the snapshot may record:

```text
local_release_handoff_ready
```

as the local handoff claim. It must not claim production readiness.

## Non-Goals

- No tag creation.
- No git push.
- No GitHub Release creation.
- No package publishing.
- No artifact upload.
- No installer packaging.
- No browser automation.
- No dev server startup.
- No production readiness claim.
- No new UI, route, playbook, fixture, replay, runtime, retention, or asset
  writeback behavior.
- No commit of generated snapshot files under `output/`.
- No secret scanning beyond the existing warning-only `release:hygiene:check`
  child gate.

## Command Contract

Script path:

```text
scripts/release-handoff/write-release-handoff-snapshot.mjs
```

Package script:

```json
"release:handoff:snapshot": "node scripts/release-handoff/write-release-handoff-snapshot.mjs"
```

Default behavior:

1. Run `npm run release:handoff:check --silent`.
2. Parse stdout as JSON.
3. Collect git context:
   - current branch;
   - current commit;
   - `git status --short` lines;
   - whether tracked changes exist;
   - whether untracked files exist.
4. Write a timestamped JSON file under `output/release-handoff/`.
5. Print a small JSON result to stdout with the snapshot path and summary.

The command should fail closed when the child gate fails. In that case it should
still write an evidence file containing the failed gate report, but the top-level
command must exit non-zero and must not include a successful release claim.

## Snapshot Output Contract

Snapshot file shape:

```json
{
  "schemaVersion": 1,
  "kind": "release_handoff_evidence_snapshot",
  "createdAt": "2026-07-07T00:00:00.000Z",
  "command": "release:handoff:snapshot",
  "sourceCommand": "release:handoff:check",
  "ok": true,
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true,
  "git": {
    "branch": "main",
    "commit": "abcdef0",
    "dirty": true,
    "hasTrackedChanges": false,
    "hasUntrackedFiles": true,
    "statusShort": ["?? output/"]
  },
  "handoffReport": {
    "ok": true,
    "command": "release:handoff:check",
    "releaseClaim": "local_release_handoff_ready",
    "productionReady": false,
    "publishingPerformed": false,
    "checks": []
  },
  "knownWarnings": [
    "snapshot is local evidence only and is not a published release artifact",
    "output/release-handoff snapshots should not be committed by default"
  ]
}
```

CLI stdout shape:

```json
{
  "ok": true,
  "command": "release:handoff:snapshot",
  "snapshotPath": "output/release-handoff/release-handoff-2026-07-07T000000000Z.json",
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

On failed handoff gate:

- `ok` is `false`;
- `releaseClaim` is omitted;
- `productionReady` remains `false`;
- `publishingPerformed` remains `false`;
- `evidenceOnly` remains `true`;
- the snapshot includes the failed child report;
- process exit code is non-zero.

## File Naming

Default filename:

```text
release-handoff-<createdAt-sanitized>.json
```

where the ISO timestamp is sanitized by removing separators that are awkward in
shell paths:

```text
2026-07-07T00:00:00.000Z -> 2026-07-07T000000000Z
```

The first implementation does not need CLI flags. The output directory may be
configurable through test injection, not through a public command contract.

## Error Handling

The script should fail closed when:

- `release:handoff:check` exits non-zero;
- child stdout is not valid JSON;
- git context commands fail;
- the snapshot file cannot be written.

If child stdout is invalid JSON, the script should not write an incomplete
snapshot. It should print a concise error to stderr and exit non-zero.

## Documentation Updates

Update:

- `CHANGELOG.md`
- `README.md`
- `docs/NEXT_STEPS.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `memory/2026-07-07.md`

Docs must say clearly:

- `release:handoff:snapshot` is a local evidence command;
- it writes under `output/release-handoff/`;
- generated snapshots are not source artifacts and should not be committed by
  default;
- it does not publish, tag, upload, package installers, or create releases;
- it preserves `productionReady: false` and `publishingPerformed: false`.

## Testing

Add:

```text
src/__tests__/scripts/release-handoff-snapshot-script.test.ts
```

Required coverage:

- successful child report writes a snapshot and returns a success summary;
- failed child report writes a failed snapshot and exits non-zero;
- invalid child JSON fails without writing a snapshot;
- git context parsing distinguishes tracked changes from untracked files;
- generated snapshot keeps `productionReady: false`,
  `publishingPerformed: false`, and `evidenceOnly: true`.

Add the snapshot script test to:

```text
npm run test:controlled-runtime
```

## Verification

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts
npm run release:handoff:snapshot
npm run release:handoff:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

The generated snapshot in `output/release-handoff/` is local evidence and should
not be staged as source.

## Acceptance Criteria

- `npm run release:handoff:snapshot` writes a local JSON evidence file under
  `output/release-handoff/`.
- The snapshot embeds the parsed `release:handoff:check` report.
- The snapshot includes git branch, commit, and short status context.
- Failed handoff gate output is preserved as evidence, but the snapshot command
  exits non-zero and does not expose a successful release claim.
- Invalid child JSON fails without writing an incomplete snapshot.
- Docs and logs describe the local-only evidence boundary consistently.
- Verification commands pass, with only the existing known `<img>` warning in
  lint/build if it appears.

## Spec Self-Review

- Placeholder scan: no placeholders remain.
- Scope check: this is one focused local evidence command and one test file.
- Boundary check: publishing, tagging, uploading, installer packaging, browser
  automation, production readiness, and committed generated evidence are out of
  scope.
- Ambiguity check: failed handoff gates write evidence but exit non-zero;
  invalid JSON writes no snapshot.
