# Release Handoff Evidence Doctor Design

## Summary

Add a local read-only doctor command that diagnoses the latest release handoff
evidence state and tells maintainers the next local command to run.

The current handoff path can run the full gate, write a local snapshot, validate
snapshots, index snapshots, and check freshness. The remaining operator gap is
triage: when evidence is missing, invalid, failed, or stale, maintainers still
need to infer the repair command from several docs. The doctor command makes
that decision explicit without creating evidence, mutating evidence, publishing,
uploading, tagging, packaging installers, creating GitHub Releases, running
browser smoke, or claiming production readiness.

## Problem

`release:handoff:evidence:check` correctly exits non-zero for stale or invalid
evidence, but its failure output is optimized for gating rather than operator
recovery. A maintainer needs a read-only diagnostic command that answers:

- is there any local evidence;
- is the latest evidence structurally valid;
- did the embedded handoff gate pass;
- does the evidence match current `HEAD`;
- what local command should be run next.

## Goals

- Add `npm run release:handoff:evidence:doctor`.
- Read the newest local snapshot from `output/release-handoff/` by default.
- Validate that newest snapshot through the existing snapshot validator.
- Compare `snapshot.git.commit` with current `git rev-parse --short HEAD` when
  validation allows it.
- Emit machine-readable JSON with:
  - `ok`;
  - `command`;
  - `snapshotDir`;
  - `status`;
  - `severity`;
  - `nextCommand`;
  - `nextAction`;
  - `productionReady: false`;
  - `publishingPerformed: false`;
  - `evidenceOnly: true`.
- Include `snapshotPath`, `snapshotCommit`, `currentCommit`, and `validation`
  when available.
- Exit `0` only for fresh valid evidence.
- Exit non-zero for missing, unreadable, invalid, failed, stale, or git-error
  evidence states.

## Status Contract

- `missing_evidence`
  - no JSON snapshots are available;
  - next command: `npm run release:handoff:snapshot`.
- `invalid_evidence`
  - latest snapshot cannot be parsed or fails schema/release-boundary validation;
  - next command: `npm run release:handoff:snapshot`.
- `failed_evidence`
  - latest snapshot is structurally valid evidence for a failed handoff gate;
  - next command: `npm run release:handoff:check`.
- `stale_evidence`
  - latest snapshot validates but its commit differs from current `HEAD`;
  - next command: `npm run release:handoff:snapshot`.
- `git_unavailable`
  - latest snapshot validates but current commit cannot be read;
  - next command: `git rev-parse --short HEAD`.
- `fresh_evidence`
  - latest snapshot validates and matches current `HEAD`;
  - next command: `npm run release:handoff:evidence:check`.

## Non-Goals

- No snapshot creation.
- No evidence mutation, cleanup, or deletion.
- No upload, publication, release tag, installer package, or GitHub Release.
- No browser automation, screenshot verification, or UI change.
- No production-readiness claim.
- No replacement for `release:handoff:check`, `release:handoff:snapshot`, or
  `release:handoff:evidence:check`.

## Command Contract

Default:

```bash
npm run release:handoff:evidence:doctor
```

Optional directory override:

```bash
npm run release:handoff:evidence:doctor -- --dir output/release-handoff
```

Expected fresh shape:

```json
{
  "ok": true,
  "command": "release:handoff:evidence:doctor",
  "snapshotDir": "output/release-handoff",
  "status": "fresh_evidence",
  "severity": "info",
  "snapshotPath": "output/release-handoff/release-handoff-2026-07-06T233855272Z.json",
  "snapshotCommit": "abcdef0",
  "currentCommit": "abcdef0",
  "nextCommand": "npm run release:handoff:evidence:check",
  "nextAction": "Fresh local handoff evidence is available; run the freshness gate when a hard pass/fail check is needed.",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true,
  "releaseClaim": "local_release_handoff_ready"
}
```

Expected stale shape:

```json
{
  "ok": false,
  "command": "release:handoff:evidence:doctor",
  "status": "stale_evidence",
  "severity": "error",
  "snapshotCommit": "abc1111",
  "currentCommit": "def2222",
  "nextCommand": "npm run release:handoff:snapshot",
  "nextAction": "Latest evidence is stale for the current commit; rerun the handoff snapshot after the local handoff gate passes.",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

## Architecture

Create `scripts/release-handoff/doctor-release-handoff-evidence.mjs`.

Responsibilities:

- parse `--dir`;
- list JSON snapshots under the directory;
- choose newest by `createdAt` descending, with filename fallback;
- parse the latest snapshot for commit context;
- validate the chosen snapshot through `checkReleaseHandoffSnapshotFile()`;
- read current git commit through an injectable git runner;
- map the observed state to `status`, `severity`, `nextCommand`, and
  `nextAction`;
- print JSON and set exit code.

Exports:

- `RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND`
- `parseReleaseHandoffEvidenceDoctorArgs(argv)`
- `doctorReleaseHandoffEvidence(options)`

The implementation should reuse the snapshot validator. It may duplicate small
latest-file selection helpers from the freshness checker for now; shared
refactoring is not required in this slice.

## Testing

Add `src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts`.

Required coverage:

- reports `fresh_evidence` with exit `0` when the latest snapshot validates and
  matches current commit;
- reports `missing_evidence` with snapshot creation guidance when no snapshot
  exists;
- reports `invalid_evidence` for invalid JSON or schema failures;
- reports `failed_evidence` for structurally valid failed handoff snapshots;
- reports `stale_evidence` when the latest snapshot commit differs from current
  commit;
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

Docs must say this command is a read-only diagnostic helper. It suggests the
next local command but does not run that command and does not generate or
publish evidence.

## Verification

Targeted:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts
```

Real local command:

```bash
npm run release:handoff:evidence:doctor
```

Full:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

The existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`
remains an accepted known warning unless a new lint/build error appears.
