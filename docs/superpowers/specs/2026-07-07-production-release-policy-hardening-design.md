# Production Release Policy Hardening Design

## Goal

Add a local read-only production release policy gate after green local delivery candidate evidence.

The gate validates that the project has an explicit production release policy packet before any production release work starts. It checks delivery candidate linkage, recorded local verification evidence, packaging/tag/upload/deployment/monitoring/rollback policy sections, approval requirements, and strict no-action boundaries. It does not publish, tag, package installers, upload artifacts, deploy, call external connectors, write stores, or claim production readiness.

## In Scope

- Add a production release policy checker.
- Read one local production release policy JSON file.
- Reuse the delivery candidate checker.
- Require the referenced delivery candidate report to be green, candidate-only, non-publishing, and non-production.
- Require policy identity fields:
  - policy id;
  - owner;
  - target version;
  - target environment;
  - release type;
  - source delivery candidate claim;
  - release decision;
  - next boundary.
- Require ordered command evidence for delivery candidate, release hygiene, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require every command evidence entry to be green with `ok: true`, `exitCode: 0`, and non-empty `recordedAt`.
- Require command metadata for delivery candidate, release hygiene, controlled-runtime counts, core workflow gate, lint/build known warnings, and diff check.
- Require policy sections for:
  - packaging;
  - tag creation;
  - artifact upload;
  - deployment;
  - external writes;
  - monitoring;
  - rollback.
- Require each release-affecting section to be explicitly approval-gated and not yet approved/executed.
- Require monitoring and rollback sections to be documented without claiming production readiness.
- Require risk summary to keep production readiness, publishing, tags, package builds, uploads, deployment, and external writes disabled, with deferred approval items recorded.
- Require release boundary proving policy-only behavior with no command execution by the checker, no publishing, no tag, no package build, no upload, no deployment, no store/external writes, no credential use, no production readiness, and no readiness claim.
- Add an npm script, tracked example policy JSON, tests, and documentation updates.

## Out of Scope

- Publish anything.
- Create release tags.
- Build installers or packages.
- Upload artifacts.
- Deploy to any environment.
- Call external connectors or use credentials.
- Mutate playbooks, fixtures, stores, business assets, or release evidence.
- Claim production readiness.
- Replace future production approval, packaging, deployment, monitoring, incident, or rollback execution gates.

## Contract

Input policy JSON:

- `policyId`
- `deliveryCandidatePath`
- `owner`
- `recordedAt`
- `productionReleasePolicy`
- `commandEvidence`
- `policySections`
- `riskSummary`
- `rollbackSummary`
- `deliveryCandidateResult`
- `releaseBoundary`
- `approvalStatus: "production_release_policy_review"`
- `notes`

Output report:

- `ok`
- `command: "release:production-policy:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `policyOnly: true`
- `readyForProductionReleasePolicyReview`
- `policyClaim: "production_release_policy_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid policy file referencing the tracked local delivery candidate passes.
- Policy fails if the referenced delivery candidate is not green, candidate-only, non-publishing, or non-production.
- Policy fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- Policy fails if packaging, tag, upload, deployment, or external write sections are approved or executed.
- Policy fails if monitoring or rollback sections are missing ownership, documentation, or rollback notes.
- Policy fails if release boundary records command execution by the checker, publishing, tag creation, package build, upload, deployment, external writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid policies and `1` for invalid policies.

## Next Boundary

After this gate is green, the next separate phase can create a production release approval packet. That packet must still be non-executing unless the operator explicitly approves release actions. Packaging, tag creation, artifact upload, deployment, external writes, and production readiness claims remain blocked until separate approved phases.
