# Release Handoff Evidence Freshness Design

## Summary

Add a local read-only command that verifies the latest release handoff evidence snapshot is fresh for the current repository commit.

The current handoff path can generate, validate, and index snapshots. The remaining review gap is freshness: a valid snapshot can still be stale if it was generated before the latest commit. The new command closes that gap without creating evidence, mutating evidence, publishing, uploading, tagging, packaging installers, creating GitHub Releases, running browser smoke, or claiming production readiness.

## Problem

Maintainers can currently run:

- `npm run release:handoff:check`
- `npm run release:handoff:snapshot`
- `npm run release:handoff:snapshot:check -- <snapshot.json>`
- `npm run release:handoff:snapshot:index -- --check --limit 5`

This proves the snapshot schema and release boundaries, but it does not prove the latest valid snapshot corresponds to the current `HEAD`. If code or docs change after the snapshot is generated, the evidence can remain structurally valid while no longer representing the current source state.

## Goals

- Add `npm run release:handoff:evidence:check`.
- Read the newest local snapshot from `output/release-handoff/` by default.
- Validate that newest snapshot using the existing snapshot validator.
- Compare `snapshot.git.commit` with current `git rev-parse --short HEAD`.
- Emit machine-readable JSON with:
  - `ok`;
  - `command`;
  - `snapshotPath`;
  - `snapshotCommit`;
  - `currentCommit`;
  - `fresh`;
  - `validation`;
  - `productionReady: false`;
  - `publishingPerformed: false`;
  - `evidenceOnly: true`.
- Exit `0` only when the newest snapshot validates successfully and `snapshot.git.commit === currentCommit`.
- Exit non-zero when:
  - no snapshot is available;
  - newest snapshot is invalid;
  - newest snapshot is structurally valid failed evidence;
  - newest snapshot commit does not match current commit;
  - git commit cannot be read.

## Non-Goals

- No snapshot creation.
- No evidence mutation or cleanup.
- No upload, publication, release tag, installer package, or GitHub Release.
- No browser automation or screenshot verification.
- No production-readiness claim.
- No replacement for `release:handoff:check`; this only checks existing local evidence freshness.

## Command Contract

Default:

```bash
npm run release:handoff:evidence:check
```

Optional directory override:

```bash
npm run release:handoff:evidence:check -- --dir output/release-handoff
```

Expected success shape:

```json
{
  "ok": true,
  "command": "release:handoff:evidence:check",
  "snapshotPath": "output/release-handoff/release-handoff-2026-07-06T170437942Z.json",
  "snapshotCommit": "abcdef0",
  "currentCommit": "abcdef0",
  "fresh": true,
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true,
  "validation": {
    "ok": true,
    "exitCode": 0,
    "snapshotOk": true
  },
  "releaseClaim": "local_release_handoff_ready"
}
```

Expected stale evidence shape:

```json
{
  "ok": false,
  "command": "release:handoff:evidence:check",
  "snapshotCommit": "abc1111",
  "currentCommit": "def2222",
  "fresh": false,
  "failure": "snapshot commit does not match current commit",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

## Architecture

Create `scripts/release-handoff/check-release-handoff-evidence.mjs`.

Responsibilities:

- parse `--dir`;
- list JSON snapshots under the directory;
- choose newest by `createdAt` descending, with filename fallback;
- validate the chosen snapshot through `checkReleaseHandoffSnapshotFile()`;
- read current git commit using an injectable git runner;
- compare snapshot commit to current commit;
- print JSON and set exit code.

Exports:

- `RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND`
- `parseReleaseHandoffEvidenceCheckArgs(argv)`
- `checkReleaseHandoffEvidence(options)`

The implementation should reuse the snapshot validator, not duplicate schema rules.

## Testing

Add `src/__tests__/scripts/release-handoff-evidence-check-script.test.ts`.

Required coverage:

- passes when newest snapshot validates and commit matches current commit;
- fails stale evidence when newest snapshot commit differs from current commit;
- fails when no snapshot exists;
- fails when newest snapshot validation exits non-zero;
- parses `--dir` and rejects unknown options.

Add the test to `test:controlled-runtime`.

## Documentation

Update:

- `README.md`
- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `memory/2026-07-07.md`

Docs must say this command checks freshness of existing local evidence only. If it fails because evidence is stale, the maintainer should generate a new snapshot after rerunning the handoff gate. The command itself still does not generate or publish evidence.

## Verification

Targeted:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-check-script.test.ts
```

Real local command:

```bash
npm run release:handoff:evidence:check
```

Full:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

The existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` remains an accepted known warning unless a new lint/build error appears.
