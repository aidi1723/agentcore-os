# Playbook Lifecycle Mutation Release Handoff Review Design

## Goal

Define a local read-only review gate after post-replacement fixture evidence and before any release handoff claim is used for project delivery review.

The gate bridges playbook lifecycle mutation evidence with the existing local release handoff evidence workflow. It validates recorded review evidence only. It does not run release commands, generate snapshots, publish, tag, package installers, upload artifacts, or claim production readiness.

## In Scope

- Add a playbook lifecycle mutation release handoff review checker.
- Read one local review JSON file.
- Reuse the post-replacement fixture evidence checker.
- Require the referenced post-replacement evidence to be green, evidence-only, non-publishing, and non-production.
- Require recorded local release handoff evidence review commands in this exact order:
  1. post-replacement evidence check;
  2. `npm run release:handoff:check`;
  3. `npm run release:handoff:snapshot`;
  4. `npm run release:handoff:evidence:status`;
  5. `npm run release:handoff:evidence:audit`;
  6. `git diff --check`.
- Require every recorded command result to be green with `ok: true`, `exitCode: 0`, and non-empty `recordedAt`.
- Require command-specific metadata proving:
  - post-replacement evidence was green;
  - release handoff claim is only `local_release_handoff_ready`;
  - snapshot evidence stayed evidence-only;
  - handoff evidence status is ready for local handoff evidence;
  - handoff evidence audit is green;
  - diff check is green.
- Require reviewer summary fields for evidence acceptance, rollback notes, and next non-production boundary.
- Require review boundaries proving no command execution by the checker, no snapshot generation by the checker, no publishing, no tag, no package build, no upload, no production readiness, and no readiness claim.
- Add an npm script, tracked example review JSON, tests, and documentation updates.

## Out of Scope

- Run `release:handoff:*` commands from the checker.
- Generate or modify `output/release-handoff/` evidence.
- Publish, tag, create GitHub Releases, package installers, or upload artifacts.
- Mutate playbooks, fixtures, stores, or business assets.
- Call external connectors.
- Claim production readiness.

## Contract

Input review JSON:

- `reviewId`
- `postReplacementEvidencePath`
- `owner`
- `recordedAt`
- `reviewSummary`
- `commandResults`
- `postReplacementEvidenceResult`
- `releaseHandoffReviewBoundary`
- `approvalStatus: "release_handoff_review"`
- `notes`

Output report:

- `ok`
- `command`
- `productionReady: false`
- `publishingPerformed: false`
- `reviewOnly: true`
- `readyForLocalReleaseHandoffReview`
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid review file referencing the tracked post-replacement evidence passes.
- Review fails if post-replacement evidence is not green, evidence-only, non-publishing, or non-production.
- Review fails if recorded command results are missing, out of order, non-green, or missing command-specific metadata.
- Review fails if reviewer acceptance, rollback notes, or next boundary are missing.
- Review fails if it records snapshot generation by the checker, publishing, tag creation, package build, upload, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid review and `1` for invalid review.

## Next Boundary

After this review is green, the next separate phase can decide whether to tighten release handoff snapshot freshness or add maintainer-facing review summaries. Production readiness and publishing remain out of scope.
