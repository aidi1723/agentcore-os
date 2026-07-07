# Release Handoff Evidence Commit Hardening Design

## Objective

Strengthen local release handoff evidence so new snapshots record the full git commit SHA and freshness checks prefer full-SHA comparison while preserving compatibility with older snapshots that only contain the existing short `git.commit` value.

## Context

AgentCore OS currently has a local release handoff evidence chain:

- `npm run release:handoff:snapshot` writes timestamped JSON evidence under `output/release-handoff/`.
- `npm run release:handoff:snapshot:check -- <snapshot.json>` validates local evidence shape and release boundaries.
- `npm run release:handoff:evidence:check` confirms the newest validated evidence matches current `HEAD`.
- `npm run release:handoff:evidence:doctor` explains missing, invalid, failed, stale, git-unavailable, or fresh evidence.
- `npm run release:handoff:evidence:status` aggregates doctor and recent snapshot-index checks.

The current freshness boundary compares `snapshot.git.commit` to `git rev-parse --short HEAD`. That is useful and compatible with existing evidence, but release handoff evidence should retain the unambiguous commit identifier whenever possible.

## Requirements

1. New handoff snapshots must keep the existing short `git.commit` field for compatibility.
2. New handoff snapshots must also write `git.commitFull` with the full current `HEAD` SHA.
3. Snapshot validation must accept old snapshots without `git.commitFull`.
4. Snapshot validation must validate `git.commitFull` when present.
5. Evidence freshness and doctor checks must compare full SHA values when the snapshot contains `git.commitFull`.
6. Evidence freshness and doctor checks must fall back to short SHA comparison for old snapshots that only contain `git.commit`.
7. A mismatching `git.commitFull` must fail freshness even if the short prefix would match.
8. Status output must surface the richer commit fields through its compact doctor report.
9. The change must remain local-only evidence hardening:
   - no publishing;
   - no artifact upload;
   - no release tag;
   - no installer packaging;
   - no GitHub Release creation;
   - no browser smoke requirement;
   - no production-readiness claim.

## Design

### Snapshot Writer

`scripts/release-handoff/write-release-handoff-snapshot.mjs` will collect both:

- `git.commit`: existing short SHA from `git rev-parse --short HEAD`;
- `git.commitFull`: new full SHA from `git rev-parse HEAD`.

The writer will preserve the existing `gitRunner(name)` injection style and add a new `commitFull` command key. Existing tests can keep returning the short value for `commit`; new tests will assert the full value is persisted.

### Snapshot Validator

`scripts/release-handoff/check-release-handoff-snapshot.mjs` will keep schema version `1` and keep `git.commitFull` optional for backward compatibility. When present, `git.commitFull` must be a non-empty string. This avoids breaking older local evidence while giving new evidence a stronger shape.

### Freshness Comparison

`scripts/release-handoff/check-release-handoff-evidence.mjs` and `scripts/release-handoff/doctor-release-handoff-evidence.mjs` will read the current full SHA using `git rev-parse HEAD`. They will derive a short current SHA by prefixing the full SHA to the length of the snapshot short commit when needed.

Comparison rules:

- If `snapshot.git.commitFull` exists, compare it to current full SHA.
- If `snapshot.git.commitFull` is absent, compare `snapshot.git.commit` to the matching current short prefix.
- If both are present and `commitFull` is stale, freshness fails even when `commit` would match.

Reports will include:

- `snapshotCommit`: existing short snapshot commit;
- `snapshotCommitFull`: new full snapshot commit when available;
- `currentCommit`: short current commit for compatibility;
- `currentCommitFull`: full current commit when git is available.

### Status Aggregation

`scripts/release-handoff/status-release-handoff-evidence.mjs` will pass through `snapshotCommitFull` and `currentCommitFull` in the compact doctor report. Its readiness rule remains unchanged: ready only when doctor reports `fresh_evidence` and the checked recent index passes.

## Acceptance Criteria

1. `writeReleaseHandoffSnapshot()` writes both `git.commit` and `git.commitFull` for new snapshots.
2. `validateReleaseHandoffSnapshot()` accepts old snapshots without `git.commitFull`.
3. `validateReleaseHandoffSnapshot()` fails snapshots whose present `git.commitFull` is not a string.
4. `checkReleaseHandoffEvidence()` passes when `git.commitFull` matches current full SHA.
5. `checkReleaseHandoffEvidence()` still passes old short-only snapshots when the short commit matches the current full SHA prefix.
6. `checkReleaseHandoffEvidence()` fails when `git.commitFull` mismatches, even if `git.commit` matches.
7. `doctorReleaseHandoffEvidence()` reports fresh/stale using the same full-first fallback behavior.
8. `buildReleaseHandoffEvidenceStatus()` exposes full commit fields in the compact doctor output.
9. Documentation and memory records explain that new evidence is full-SHA hardened while old local evidence remains readable.

## Verification Plan

Run, at minimum:

```bash
npm test -- src/__tests__/scripts/release-handoff-snapshot-script.test.ts src/__tests__/scripts/release-handoff-snapshot-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-check-script.test.ts src/__tests__/scripts/release-handoff-evidence-doctor-script.test.ts src/__tests__/scripts/release-handoff-evidence-status-script.test.ts
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

After committing the implementation, refresh local-only evidence and verify:

```bash
npm run release:handoff:snapshot
npm run release:handoff:evidence:status
npm run release:handoff:evidence:check
```

Generated files under `output/` remain local-only and must not be committed by default.

## Scope Boundaries

This phase does not change runtime workflow logic, UI, release version, license, package publishing, installer generation, GitHub Releases, artifact uploads, public deployment, or production-readiness claims.
