# Production Release Approval Packet Design

## Goal

Add a local read-only production release approval packet gate after a green production release policy packet.

The gate validates that any future release action has an explicit human approval packet with reviewer identity, approval scope, expiry, rollback owner, monitoring owner, and per-action decisions. It does not publish, tag, package, upload artifacts, deploy, call external connectors, write stores, use credentials, or claim production readiness.

## In Scope

- Add a production release approval packet checker.
- Read one local approval packet JSON file.
- Reuse the production release policy checker.
- Require the referenced policy report to be green, policy-only, non-publishing, and non-production.
- Require approval packet identity fields:
  - approval id;
  - policy path;
  - reviewer;
  - recorded time;
  - approval scope;
  - expiry;
  - rollback owner;
  - monitoring owner;
  - next boundary.
- Require explicit release action decisions for:
  - packaging;
  - tag creation;
  - artifact upload;
  - deployment;
  - external writes.
- Require every release action decision to be documented, approval-required, and still not executed by this checker.
- Require at least one action to remain `blocked_until_execution_gate` so the packet cannot be mistaken for execution authority.
- Require monitoring and rollback owner sections.
- Require command evidence for production policy, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require release boundary proving approval-packet-only behavior with no publishing, no tag, no package build, no upload, no deployment, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.
- Add an npm script, tracked example approval JSON, tests, docs, and memory updates.

## Out of Scope

- Publish anything.
- Create release tags.
- Build installers or packages.
- Upload artifacts.
- Deploy to any environment.
- Call external connectors or use credentials.
- Mutate playbooks, fixtures, stores, business assets, or release evidence.
- Claim production readiness.
- Replace future packaging, tag, upload, deployment, monitoring, incident, or rollback execution gates.

## Contract

Input approval JSON:

- `approvalId`
- `productionPolicyPath`
- `reviewer`
- `recordedAt`
- `expiresAt`
- `approvalScope: "production_release_approval_packet"`
- `productionReleasePolicyResult`
- `commandEvidence`
- `releaseActionDecisions`
- `rollbackOwner`
- `monitoringOwner`
- `riskAcceptance`
- `approvalBoundary`
- `approvalStatus: "approved_for_release_execution_planning"`
- `notes`

Output report:

- `ok`
- `command: "release:production-approval:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `approvalPacketOnly: true`
- `readyForReleaseExecutionPlanning`
- `approvalClaim: "production_release_approval_packet_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid approval packet referencing the tracked production release policy passes.
- Approval fails if the referenced policy report is not green, policy-only, non-publishing, or non-production.
- Approval fails if reviewer identity, approval scope, expiry, rollback owner, or monitoring owner is missing.
- Approval fails if expiry is not later than `recordedAt`.
- Approval fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- Approval fails if release action decisions are missing, executed, or claim authority beyond a future execution gate.
- Approval fails if release boundary records publishing, tag creation, package build, upload, deployment, external writes, store writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid packets and `1` for invalid packets.

## Next Boundary

After this gate is green, the next separate phase can create release execution planning gates for packaging/tag/upload/deployment. Those gates must remain separate from this approval packet and must still avoid production readiness claims until production verification exists.
