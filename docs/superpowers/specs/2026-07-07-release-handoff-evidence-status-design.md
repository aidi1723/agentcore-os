# Release Handoff Evidence Status Design

## Summary

Add a local read-only status command that aggregates release handoff evidence
doctor output and recent snapshot index validation into one machine-readable
report.

The current handoff evidence path can diagnose the latest snapshot and validate
recent snapshots, but maintainers still need to run and compare multiple
commands to answer whether local handoff evidence is reviewable. The status
command provides that combined read-only view without running the full handoff
gate, generating evidence, mutating evidence, publishing, uploading, tagging,
packaging installers, creating GitHub Releases, running browser smoke, or
claiming production readiness.

## Problem

Maintainers currently have two complementary evidence review commands:

- `npm run release:handoff:evidence:doctor` explains the latest evidence state
  and next command.
- `npm run release:handoff:snapshot:index -- --check --limit 5` lists and
  validates recent local evidence files.

For handoff review, these need to be read together. A fresh latest snapshot is
not the whole story if the recent evidence set contains invalid files, and an
index alone does not explain the next operator action. A single status report
reduces manual interpretation while preserving the existing command boundaries.

## Goals

- Add `npm run release:handoff:evidence:status`.
- Reuse the existing evidence doctor helper.
- Reuse the existing snapshot index helper with `check: true`.
- Default to:
  - `snapshotDir: "output/release-handoff"`;
  - `limit: 5`.
- Support CLI flags:
  - `--dir <path>`;
  - `--limit <positive integer>`.
- Emit machine-readable JSON with:
  - `ok`;
  - `command`;
  - `snapshotDir`;
  - `limit`;
  - `readyForLocalHandoffEvidence`;
  - `doctor`;
  - `index`;
  - `nextCommand`;
  - `nextAction`;
  - `productionReady: false`;
  - `publishingPerformed: false`;
  - `evidenceOnly: true`.
- Exit `0` only when:
  - doctor exits `0`;
  - doctor status is `fresh_evidence`;
  - checked snapshot index exits `0`;
  - index count is greater than `0`.
- Exit non-zero when latest evidence is missing, invalid, failed, stale,
  git-unavailable, or when any checked recent snapshot fails validation.

## Non-Goals

- No snapshot creation.
- No evidence mutation, cleanup, deletion, or repair.
- No full `release:handoff:check` execution.
- No `release:handoff:snapshot` execution.
- No upload, publication, release tag, installer package, or GitHub Release.
- No browser automation or screenshot verification.
- No production-readiness claim.
- No replacement for the doctor, freshness gate, snapshot index, or full handoff
  gate.

## Command Contract

Default:

```bash
npm run release:handoff:evidence:status
```

Optional directory and limit override:

```bash
npm run release:handoff:evidence:status -- --dir output/release-handoff --limit 3
```

Expected fresh shape:

```json
{
  "ok": true,
  "command": "release:handoff:evidence:status",
  "snapshotDir": "output/release-handoff",
  "limit": 5,
  "readyForLocalHandoffEvidence": true,
  "nextCommand": "npm run release:handoff:evidence:check",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true,
  "doctor": {
    "exitCode": 0,
    "status": "fresh_evidence",
    "snapshotPath": "output/release-handoff/release-handoff-2026-07-06T235512183Z.json"
  },
  "index": {
    "exitCode": 0,
    "count": 5,
    "checked": true
  }
}
```

Expected stale shape:

```json
{
  "ok": false,
  "command": "release:handoff:evidence:status",
  "readyForLocalHandoffEvidence": false,
  "nextCommand": "npm run release:handoff:snapshot",
  "doctor": {
    "exitCode": 1,
    "status": "stale_evidence"
  },
  "index": {
    "exitCode": 0,
    "checked": true
  },
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

## Architecture

Create `scripts/release-handoff/status-release-handoff-evidence.mjs`.

Responsibilities:

- parse `--dir` and `--limit`;
- call `doctorReleaseHandoffEvidence()`;
- call `buildReleaseHandoffSnapshotIndex({ check: true, limit })`;
- build a compact status report that preserves the full doctor/index reports;
- derive `readyForLocalHandoffEvidence`;
- forward `nextCommand` and `nextAction` from doctor unless index validation
  fails, in which case recommend `npm run release:handoff:snapshot:index -- --check --limit <limit>`;
- print JSON and set exit code.

Exports:

- `RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND`
- `parseReleaseHandoffEvidenceStatusArgs(argv)`
- `buildReleaseHandoffEvidenceStatus(options)`

The implementation should reuse existing helpers rather than invoking npm
subprocesses. That keeps tests deterministic and avoids accidentally running
gates that can mutate local state.

## Testing

Add `src/__tests__/scripts/release-handoff-evidence-status-script.test.ts`.

Required coverage:

- reports ready when doctor is fresh and checked index passes;
- reports not ready and forwards doctor guidance when doctor is stale;
- reports not ready and recommends index review when checked index validation
  fails even if doctor is fresh;
- reports not ready when there are no snapshots;
- parses `--dir` and `--limit`, rejects unknown options, and rejects invalid
  limits.

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

Docs must say this command is a read-only status summary. It aggregates existing
doctor and index checks but does not run the full handoff gate, does not
generate a snapshot, and does not publish anything.

## Verification

Targeted:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
```

Real local command:

```bash
npm run release:handoff:evidence:status
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
