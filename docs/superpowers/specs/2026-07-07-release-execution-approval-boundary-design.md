# Release Execution Approval Boundary Design

## Goal

Add a local read-only release execution approval boundary after a green production verification gate.

The boundary validates that final operator approval requirements are defined before any real release execution can be considered. It does not approve or execute publishing, tag creation, package builds, artifact uploads, deployment, production verification, connector calls, external writes, store writes, credential use, or production-readiness claims.

## Scope

- Add a release execution approval boundary checker.
- Read one local release execution approval JSON file.
- Reuse the production verification gate checker.
- Require the referenced production verification gate report to be green, verification-only, non-publishing, and non-production.
- Require release execution approval identity fields:
  - approval id;
  - production verification gate path;
  - owner id, name, and `release_execution_approval_boundary_reviewer` role;
  - recorded timestamp;
  - expiry timestamp after recorded timestamp;
  - target version;
  - approval scope.
- Require execution readiness review metadata for:
  - package build gate;
  - tag creation gate;
  - artifact upload gate;
  - deployment gate;
  - external-write gate;
  - production verification gate.
- Require operator approval requirements:
  - approver role;
  - two-person review requirement;
  - change window declaration;
  - rollback owner declaration;
  - monitoring owner declaration;
  - credential-use separate approval requirement.
- Require ordered command evidence for production verification gate, release hygiene, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require release action authorization metadata for package build, tag creation, artifact upload, deployment, external writes, and production verification.
- Require all release action authorizations to remain blocked until manual operator execution approval.
- Require credential boundary to prove credentials are not required, used, approved, or recorded by the gate.
- Require approval boundary to prove approval-boundary-only behavior with no command execution, no release execution approval, no release execution, no production verification execution, no connector calls, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.

## Non-Goals

- Execute release commands.
- Approve real release execution.
- Run production verification commands.
- Publish, tag, package, upload, deploy, or call external connectors.
- Perform external writes or store writes.
- Use or expose credentials.
- Change UI.
- Claim production readiness.

## Contract

The checker emits:

- `ok`
- `command: "release:execution-approval:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `approvalBoundaryOnly: true`
- `readyForManualReleaseExecutionDecisionReview`
- `releaseExecutionApprovalClaim: "release_execution_approval_boundary_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

The checker fails closed if:

- the referenced production verification gate is not green, verification-only, non-publishing, or non-production;
- the recorded production verification result is not green;
- identity, scope, target version, or expiry fields are missing or invalid;
- execution readiness review metadata is incomplete;
- operator approval requirements are incomplete;
- command evidence is missing, out of order, non-green, or missing expected metadata;
- release action authorization approves or records execution;
- credential boundary allows or records credential use;
- approval boundary records release execution approval, release execution, production verification execution, connector calls, external writes, store writes, credential use, production readiness, or readiness claim.

## Test Plan

- A valid release execution approval boundary referencing the tracked production verification gate passes.
- The boundary fails if the referenced production verification gate report is not green, verification-only, non-publishing, or non-production.
- The boundary fails if approval expiry is invalid or owner identity is missing.
- The boundary fails if release action authorization approves execution or records execution.
- The boundary fails if command evidence order or metadata drifts.
- The CLI parses `--approval` and `--compact`.
- The CLI fails on missing path, invalid JSON, and invalid upstream production verification evidence.

## Documentation Plan

Update:

- `README.md`
- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/PROJECT_FRAMEWORK.zh-CN.md`
- `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/DOCUMENTATION_INDEX.zh-CN.md`
- `memory/2026-07-07.md`

## Boundary

After this boundary is green, release execution is still not performed by the project. Actual publishing, tag creation, package building, artifact upload, deployment, production verification execution, connector calls, external writes, store writes, credential use, and production readiness claims remain blocked until explicit human/operator action and separate post-execution evidence exist.
