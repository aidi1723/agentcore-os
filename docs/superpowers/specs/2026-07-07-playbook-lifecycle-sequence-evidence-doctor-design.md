# Playbook Lifecycle Sequence Evidence Doctor Design

## Goal

Add a local read-only doctor command for playbook lifecycle sequence evidence, so maintainers can quickly see whether evidence is fresh, missing, invalid, stale, tied to the wrong commit, tied to the wrong sequence digest, or recorded with an invalid/future timestamp.

## Context

The lifecycle maintenance path now has:

- proposal check;
- migration plan check;
- maintenance sequence check;
- sequence evidence check;
- freshness/provenance check.

The remaining usability gap is triage. The freshness checker fails closed, but maintainers still need to infer the recovery category and next command from raw findings. A doctor command should classify the existing local evidence without creating evidence, running sequence commands, mutating playbooks, refreshing fixtures, or publishing.

## Design

Add:

```bash
npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence <path>
```

The doctor will:

- require `--evidence <path>`;
- support `--now <iso-date>`, `--current-commit <commit>`, and `--compact`;
- verify the evidence path exists before invoking the freshness checker;
- call the existing freshness checker as the single source of validation truth;
- parse the freshness report and map findings into one `status`;
- emit a machine-readable JSON report with `nextCommand` and `nextAction`;
- exit `0` only for fresh evidence.

Status mapping:

- `fresh_evidence`: freshness report is green;
- `missing_evidence`: evidence path does not exist;
- `invalid_evidence`: evidence JSON cannot be parsed or the referenced sequence evidence report is not green;
- `invalid_provenance`: provenance shape is missing or malformed;
- `sequence_digest_mismatch`: evidence references a different sequence file digest;
- `source_commit_mismatch`: evidence references a different source commit;
- `future_recorded_at`: evidence `recordedAt` is later than review `now`;
- `stale_evidence`: evidence is older than `maxAgeHours`;
- `invalid_recorded_at`: evidence or review timestamp is not parseable.

## Boundaries

No command execution from evidence, no evidence generation, no UI, no authoring screen, no registered playbook mutation, no migration execution, no fixture mutation, no store writes, no external connector writes, no release, no browser smoke, and no production-readiness claim.

This is a diagnostic wrapper over the freshness checker. It classifies existing local evidence and suggests the next local command; it does not run the suggested command.
