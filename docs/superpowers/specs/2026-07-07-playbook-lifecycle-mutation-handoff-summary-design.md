# Playbook Lifecycle Mutation Handoff Summary Design

## Goal

Define a local read-only handoff summary gate after green release handoff review.

The gate turns the long evidence chain into a maintainer-readable structured summary. It validates that release handoff review is green and that the summary records scope, command evidence, risk posture, rollback notes, and the next non-production boundary. It does not run commands, generate snapshots, publish, tag, package installers, upload artifacts, or claim production readiness.

## In Scope

- Add a playbook lifecycle mutation handoff summary checker.
- Read one local summary JSON file.
- Reuse the release handoff review checker.
- Require the referenced release handoff review to be green, review-only, non-publishing, and non-production.
- Require `handoffSummary` fields for:
  - target playbook id;
  - lifecycle mutation status;
  - evidence chain status;
  - local release handoff claim;
  - maintainer decision;
  - next boundary.
- Require command summary entries for release handoff review, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require every command summary entry to be green with `ok: true`, `exitCode: 0`, and non-empty `recordedAt`.
- Require risk summary entries that preserve known non-production boundaries and include at least one deferred item.
- Require rollback summary with available rollback and non-empty notes.
- Require summary boundaries proving no command execution by the checker, no snapshot generation by the checker, no store writes, no external writes, no publishing, no tag, no package build, no upload, no production readiness, and no readiness claim.
- Add an npm script, tracked example summary JSON, tests, and documentation updates.

## Out of Scope

- Run release handoff, test, lint, build, or diff commands from the checker.
- Generate or modify `output/release-handoff/` evidence.
- Publish, tag, create GitHub Releases, package installers, or upload artifacts.
- Mutate playbooks, fixtures, stores, or business assets.
- Call external connectors.
- Claim production readiness.

## Contract

Input summary JSON:

- `summaryId`
- `releaseHandoffReviewPath`
- `owner`
- `recordedAt`
- `handoffSummary`
- `commandSummary`
- `riskSummary`
- `rollbackSummary`
- `releaseHandoffReviewResult`
- `handoffSummaryBoundary`
- `approvalStatus: "handoff_summary_review"`
- `notes`

Output report:

- `ok`
- `command`
- `productionReady: false`
- `publishingPerformed: false`
- `summaryOnly: true`
- `readyForMaintainerHandoffSummary`
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid summary file referencing the tracked release handoff review passes.
- Summary fails if the referenced release handoff review is not green, review-only, non-publishing, or non-production.
- Summary fails if command summary entries are missing, out of order, non-green, or missing required metadata.
- Summary fails if risk summary or rollback summary is missing required non-production boundaries.
- Summary fails if it records command execution by the checker, snapshot generation by the checker, publishing, tag creation, package build, upload, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid summary and `1` for invalid summary.

## Next Boundary

After this summary is green, the next separate phase can harden unified policy/guardrail coverage or maintainer-facing authoring/versioning workflow. Production readiness and publishing remain out of scope.
