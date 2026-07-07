# Playbook Lifecycle Mutation Fixture Replacement Handoff Design

## Goal

Define a local read-only handoff gate after candidate fixture review and before any manual committed fixture replacement.

The gate turns "candidate review is green" into an explicit replacement handoff contract. It verifies target alignment, scoped committed fixture path, rollback planning, and required post-replacement validation plan without replacing fixture JSON, refreshing fixtures, writing stores, publishing, or claiming production readiness.

## In Scope

- Add a fixture replacement handoff checker.
- Read a local handoff JSON file.
- Reuse the candidate fixture review checker.
- Require the referenced candidate fixture review to be green, review-only, non-publishing, and non-production.
- Require `catalogFixtureId`, `targetPlaybookId`, `candidateFixturePath`, and `committedFixturePath` to match the referenced candidate review.
- Require the committed fixture path to stay under `src/__tests__/fixtures/controlled-traces/`.
- Require rollback evidence before replacement: prior committed fixture reviewed, diff review planned, scoped restore path, documented restore plan, and rollback notes.
- Require post-replacement validation plan: governed fixture catalog, fixture summary, controlled runtime tests, core workflow tests, and `git diff --check`.
- Require boundary fields proving no replacement has been performed by this gate, no fixture refresh, no store writes, no external writes, no publishing, and no production readiness.
- Add an npm script, tracked example handoff JSON, tests, and documentation updates.

## Out of Scope

- Generate candidate fixtures.
- Replace committed fixture files.
- Refresh fixture catalog files.
- Run catalog/runtime commands from the checker.
- Write stores or call external connectors.
- Publish, tag, package installers, upload artifacts, or claim production readiness.

## Contract

Input handoff JSON:

- `handoffId`: stable id for this handoff.
- `owner`: responsible maintainer group.
- `candidateReviewPath`: path to a green candidate fixture review JSON.
- `catalogFixtureId`: governed fixture catalog id.
- `targetPlaybookId`: playbook affected by the replacement.
- `candidateFixturePath`: reviewed candidate fixture path.
- `committedFixturePath`: target committed fixture path.
- `replacementReason`: reason for manual replacement.
- `rollbackEvidence`: booleans and notes proving rollback has been planned before replacement.
- `postReplacementValidationPlan`: booleans declaring required validation after manual replacement.
- `replacementBoundary`: read-only boundary for this handoff gate.
- `replacementPolicy`: `manual_replacement_requires_post_replacement_evidence`.
- `publishingPolicy`: `no_publish_or_release`.
- `productionPolicy`: `no_production_ready_claim`.
- `approvalStatus`: `fixture_replacement_handoff_only`.

Output report:

- `ok`
- `command`
- `productionReady: false`
- `publishingPerformed: false`
- `handoffOnly: true`
- `readyForManualCommittedFixtureReplacement`
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid handoff referencing the tracked candidate review passes.
- A handoff fails if candidate review is not green.
- A handoff fails if target playbook, catalog fixture id, or fixture paths drift from the referenced review.
- A handoff fails if rollback evidence is incomplete.
- A handoff fails if post-replacement validation plan is incomplete.
- A handoff fails if it records committed fixture replacement, fixture refresh, store/external writes, publishing, or production readiness.
- The CLI returns exit code `0` for valid handoff and `1` for invalid handoff.
- The checker remains read-only and does not run validation commands.

## Next Boundary

After this handoff is green, a maintainer may manually replace committed fixture JSON in git. The following phase should validate post-replacement evidence before any release handoff.
