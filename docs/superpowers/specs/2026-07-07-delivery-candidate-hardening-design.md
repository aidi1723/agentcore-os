# Delivery Candidate Hardening Design

## Goal

Add a local read-only delivery candidate gate after green playbook lifecycle mutation handoff summary evidence.

The gate turns the current local controlled-runtime evidence chain into a single delivery-candidate report. It validates that maintainer handoff summary evidence is green, local delivery readiness remains green, full regression/build commands are recorded as green, documentation is aligned, and all non-production boundaries are preserved. It does not publish, tag, package installers, upload artifacts, call external connectors, write stores, or claim production readiness.

## In Scope

- Add a delivery candidate checker.
- Read one local delivery candidate JSON file.
- Reuse the handoff summary checker.
- Reuse the delivery ready checker.
- Require the referenced handoff summary to be green, summary-only, non-publishing, and non-production.
- Require local delivery readiness to be green with `releaseClaim: "local_delivery_demo_ready"` and `productionReady: false`.
- Require candidate fields for:
  - candidate id;
  - owner;
  - target milestone;
  - local delivery candidate claim;
  - source handoff claim;
  - next boundary.
- Require ordered command evidence for handoff summary, delivery ready, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require every command evidence entry to be green with `ok: true`, `exitCode: 0`, and non-empty `recordedAt`.
- Require command metadata for handoff summary, delivery readiness, controlled-runtime counts, core workflow gate, lint/build known warnings, and diff check.
- Require documentation summary to list updated project, framework, next steps, development manual, documentation index, and changelog files.
- Require risk summary to keep production readiness, publishing approval, external writes, tag, package, and upload disabled, with deferred production items recorded.
- Require rollback summary with rollback available and rollback notes.
- Require delivery candidate boundary proving candidate-only behavior with no checker command execution, no store/external writes, no publishing, no tag, no package build, no upload, no production readiness, and no production readiness claim.
- Add an npm script, tracked example candidate report, tests, and documentation updates.

## Out of Scope

- Run full regression, lint, build, or diff commands from the delivery candidate checker.
- Generate release snapshots.
- Publish, tag, create GitHub Releases, package installers, or upload artifacts.
- Mutate playbooks, fixtures, stores, or business assets.
- Call external connectors.
- Claim production readiness.
- Replace future production release, packaging, deployment, monitoring, or incident-operation gates.

## Contract

Input candidate JSON:

- `candidateId`
- `handoffSummaryPath`
- `owner`
- `recordedAt`
- `deliveryCandidate`
- `commandEvidence`
- `documentationSummary`
- `riskSummary`
- `rollbackSummary`
- `handoffSummaryResult`
- `deliveryReadyResult`
- `deliveryCandidateBoundary`
- `approvalStatus: "delivery_candidate_review"`
- `notes`

Output report:

- `ok`
- `command: "delivery:candidate:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `candidateOnly: true`
- `readyForLocalDeliveryCandidate`
- `deliveryClaim: "local_delivery_candidate_ready"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid candidate report referencing the tracked handoff summary passes.
- Candidate report fails if the referenced handoff summary is not green, summary-only, non-publishing, or non-production.
- Candidate report fails if local delivery readiness is not green, lacks `local_delivery_demo_ready`, or claims production readiness.
- Candidate report fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- Candidate report fails if required documentation files are not listed.
- Candidate report fails if risk, rollback, or boundary summaries allow publishing, tag, package, upload, external writes, production readiness, or production readiness claims.
- The CLI returns exit code `0` for valid candidate reports and `1` for invalid reports.

## Next Boundary

After this gate is green, the project can be described as a local delivery candidate. Production release remains a separate phase requiring explicit release approval, packaging/tagging policy, external connector policy, deployment environment validation, monitoring/rollback runbooks, and production readiness evidence.
