# Playbook Lifecycle Mutation Post-Replacement Evidence Design

## Goal

Define a local read-only evidence gate after a maintainer manually replaces committed governed fixture JSON.

The gate verifies that manual replacement has recorded green fixture/catalog/runtime evidence before any release handoff. It does not replace fixtures, refresh fixtures, run commands, write stores, publish, or claim production readiness.

## In Scope

- Add a post-replacement fixture evidence checker.
- Read one local evidence JSON file.
- Reuse the fixture replacement handoff checker.
- Require the referenced fixture replacement handoff to be green, handoff-only, non-publishing, and non-production.
- Require replacement summary to match the handoff target playbook, catalog fixture id, candidate fixture path, and committed fixture path.
- Require evidence that manual replacement was reviewed in git diff and rollback remains available.
- Require command evidence in this exact order:
  1. fixture replacement handoff check;
  2. `npm run trace:fixtures --silent`;
  3. `npm run trace:fixtures:summary --silent`;
  4. `npm run test:controlled-runtime`;
  5. `npm run test:core-workflows`;
  6. `git diff --check`.
- Require every command result to be green with `ok: true`, `exitCode: 0`, and non-empty `recordedAt`.
- Require command-specific metadata for fixture handoff, governed fixture gate, fixture summary gate, controlled-runtime counts, core workflow gate, and diff check.
- Require evidence boundaries proving no fixture refresh automation, no store writes, no external writes, no publishing, no production readiness, and no readiness claim.
- Add an npm script, tracked example evidence JSON, tests, and documentation updates.

## Out of Scope

- Replace committed fixture files.
- Generate candidate fixtures.
- Run validation commands from the checker.
- Mutate stores or business assets.
- Call external connectors.
- Publish, tag, package installers, upload artifacts, or claim production readiness.

## Contract

Input evidence JSON:

- `evidenceId`
- `replacementHandoffPath`
- `owner`
- `recordedAt`
- `replacementSummary`
- `commandResults`
- `replacementHandoffResult`
- `postReplacementBoundary`
- `approvalStatus: "post_replacement_fixture_evidence"`

Output report:

- `ok`
- `command`
- `productionReady: false`
- `publishingPerformed: false`
- `evidenceOnly: true`
- `readyForReleaseHandoffReview`
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid evidence file referencing the tracked fixture replacement handoff passes.
- Evidence fails if the referenced replacement handoff is not green.
- Evidence fails if command results are missing, out of order, non-green, or missing required command metadata.
- Evidence fails if replacement summary does not match the handoff target/catalog/path data.
- Evidence fails if rollback or git diff review evidence is absent.
- Evidence fails if it records store writes, external writes, publishing, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid evidence and `1` for invalid evidence.

## Next Boundary

After this evidence is green, a future release handoff review can decide whether local delivery evidence is sufficient for a non-production handoff. Production readiness remains out of scope.
