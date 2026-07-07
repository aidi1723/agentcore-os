# Playbook Lifecycle Sequence Evidence Freshness Contract Design

## Goal

Add a local read-only freshness and provenance checker for playbook lifecycle sequence evidence, after the evidence contract is structurally green but before maintainers use that evidence to justify any playbook, fixture, store, or connector mutation.

## Context

The current lifecycle path can now validate:

- proposal intake;
- migration planning;
- ordered maintenance sequence declaration;
- recorded sequence evidence.

The remaining gap is freshness. A recorded evidence file can be structurally valid while still being stale, tied to an older source commit, or describing a different sequence file than the one currently checked out. The next control-chain layer should make that stale-evidence failure mode explicit.

## Design

Add `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence <path>`.

The checker will:

- read the local evidence JSON;
- read the referenced sequence / proposal / migration plan JSON;
- reuse the existing sequence evidence checker;
- compute the SHA-256 digest of the referenced sequence file;
- compare evidence provenance with the current commit and sequence digest;
- compare `recordedAt` with a max-age policy.

Evidence files must include:

```json
"provenance": {
  "sourceCommit": "short-or-full-commit",
  "sourceCommitFull": "full-commit",
  "sequenceDigest": "sha256...",
  "maxAgeHours": 24
}
```

Validation rules:

- the referenced sequence evidence report must be green;
- `provenance.sourceCommit` and `provenance.sequenceDigest` must be non-empty;
- `provenance.sequenceDigest` must match the SHA-256 digest of the referenced sequence JSON file;
- if `provenance.sourceCommitFull` is present, it must match the current full commit;
- otherwise `provenance.sourceCommit` must match the prefix of the current full commit;
- `maxAgeHours` must be a positive number;
- `recordedAt` must not be later than the review `now` timestamp;
- evidence age must be less than or equal to `maxAgeHours`;
- output must include `productionReady: false`, `publishingPerformed: false`, and `freshnessOnly: true`.

The CLI supports deterministic review options:

- `--now <iso-date>`;
- `--current-commit <commit>`.

Without these options, it reads current time and current `git rev-parse HEAD`.

## Boundaries

No command execution from evidence, no evidence generation, no UI, no authoring screen, no registered playbook mutation, no migration execution, no fixture mutation, no store writes, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This is a freshness/provenance contract only. It does not prove that the evidence commands ran in this process; it proves that a structurally valid evidence file is still tied to the expected source commit, sequence file digest, and freshness window.
