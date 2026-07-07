# Release Handoff Evidence Audit Design

## Objective

Add a read-only cross-snapshot audit command for local release handoff evidence so maintainers can review recent evidence health, detect invalid or failed historical snapshots, and see whether recent evidence has full commit coverage without manually inspecting every JSON file.

## Context

AgentCore OS now has a local release handoff evidence chain:

- `release:handoff:snapshot` writes local evidence under `output/release-handoff/`.
- `release:handoff:snapshot:check -- <snapshot.json>` validates one snapshot.
- `release:handoff:snapshot:index -- --check --limit 5` lists and validates recent snapshots.
- `release:handoff:evidence:check` verifies the newest valid evidence matches current `HEAD`.
- `release:handoff:evidence:doctor` diagnoses the newest evidence.
- `release:handoff:evidence:status` combines the newest-evidence doctor with checked recent index state.

The remaining review gap is cross-snapshot summary. The index shows individual entries, but a maintainer still has to scan each entry to answer:

- How many recent snapshots were valid, failed, invalid JSON, or schema-invalid?
- Is the newest evidence locally ready?
- Do recent successful snapshots include full commit evidence?
- What command should be run next if the audit finds issues?

## Requirements

1. Add `npm run release:handoff:evidence:audit`.
2. The command must be read-only.
3. The command must reuse existing checked snapshot index behavior instead of duplicating snapshot validation rules.
4. The command must support:
   - `--dir <path>` for a custom evidence directory;
   - `--limit <n>` for the number of recent snapshots to audit, defaulting to `10`.
5. The report must include:
   - `ok`;
   - `command`;
   - `snapshotDir`;
   - `limit`;
   - `count`;
   - `summary`;
   - `latestSnapshot`;
   - `findings`;
   - `nextCommand`;
   - `nextAction`;
   - `productionReady: false`;
   - `publishingPerformed: false`;
   - `evidenceOnly: true`.
6. The summary must count:
   - total snapshots audited;
   - successful snapshots;
   - structurally valid failed handoff snapshots;
   - invalid snapshots;
   - invalid JSON snapshots;
   - snapshots with full commit evidence;
   - snapshots missing full commit evidence.
7. The command must exit `0` only when:
   - at least one snapshot is present;
   - the checked index exits `0`;
   - the latest snapshot is successful;
   - every audited successful snapshot has full commit evidence.
8. The command must exit non-zero when:
   - no snapshots exist;
   - any audited snapshot is invalid or failed;
   - the latest audited snapshot is not successful;
   - any audited successful snapshot is missing `git.commitFull`.
9. The command must preserve old evidence visibility. Short-only snapshots are not hidden; they are reported as `missing_full_commit_evidence` findings so maintainers know whether to regenerate evidence.
10. The command must not:
    - run the full handoff gate;
    - generate a snapshot;
    - modify evidence;
    - publish;
    - upload artifacts;
    - tag;
    - package installers;
    - create GitHub Releases;
    - run browser smoke;
    - claim production readiness.

## Design

### Command

Create `scripts/release-handoff/audit-release-handoff-evidence.mjs` and wire it as:

```bash
npm run release:handoff:evidence:audit
```

The command will call:

```js
buildReleaseHandoffSnapshotIndex({ check: true, limit, snapshotDir })
```

This keeps validation centralized in the existing snapshot validator.

### Classification

Each indexed snapshot will be classified from the checked index entry:

- `success`: `entry.validation.exitCode === 0` and `entry.ok === true`.
- `failed_evidence`: `entry.validation.ok === true`, `entry.validation.exitCode !== 0`, and `entry.validation.snapshotOk === false`.
- `invalid_json`: `entry.validation.error === "snapshot file is not valid JSON"`.
- `invalid_evidence`: any other checked validation failure.

Full commit coverage is detected by reading the snapshot JSON and checking whether `git.commitFull` is a non-empty string. Invalid JSON entries count as missing full commit evidence only through their invalid classification, not through the full-commit coverage denominator for successful snapshots.

### Findings

The command will emit compact machine-readable findings:

- `no_snapshots`
- `checked_index_failed`
- `latest_snapshot_not_successful`
- `failed_evidence`
- `invalid_evidence`
- `invalid_json`
- `missing_full_commit_evidence`

Findings include `severity`, `count`, and affected `paths` where useful.

### Next Command

The command will recommend:

- `npm run release:handoff:snapshot` when no snapshots exist, latest evidence is not successful, or successful evidence is missing full commit evidence;
- `npm run release:handoff:snapshot:index -- --check --limit <n>` when checked index validation fails;
- `npm run release:handoff:evidence:status` when the audit passes.

### Exit Code

Exit code `0` means the audited evidence window is locally clean for review. It does not mean production ready.

Exit code `1` means a maintainer should inspect or regenerate local evidence before using the evidence window for handoff review.

## Acceptance Criteria

1. `release:handoff:evidence:audit` is available in `package.json`.
2. The audit command returns a non-zero report with `no_snapshots` when the evidence directory is missing or empty.
3. The audit command returns `ok: true` when the audited window contains successful checked snapshots with full commit evidence.
4. The audit command returns non-zero when a checked snapshot is failed evidence.
5. The audit command returns non-zero when a checked snapshot is invalid JSON or schema-invalid evidence.
6. The audit command returns non-zero when a successful snapshot is missing `git.commitFull`.
7. The audit command recommends the existing snapshot/index/status commands without running them.
8. The audit command is included in `test:controlled-runtime`.
9. Documentation explains that the audit is read-only and not a release, publishing, upload, tag, installer, GitHub Release, browser smoke, or production-readiness action.

## Verification Plan

Run:

```bash
npm test -- src/__tests__/scripts/release-handoff-evidence-audit-script.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

After the implementation commit, refresh and audit local evidence:

```bash
npm run release:handoff:snapshot
npm run release:handoff:evidence:audit
npm run release:handoff:evidence:status
npm run release:handoff:evidence:check
```

Generated evidence under `output/` remains local-only and must not be committed by default.

## Scope Boundaries

This phase changes local evidence review scripts, tests, docs, and maintenance logs only. It does not change runtime workflows, UI, release version, license, packaging, external publishing, artifact upload, GitHub Releases, or production-readiness claims.
