# Production Verification Gate Design

## Goal

Add a local read-only production verification gate after a green external-write execution gate.

The gate validates that production verification requirements are fully defined before any final release execution approval can be considered. It does not run production verification, publish, tag, package, upload, deploy, call connectors, perform external writes, write stores, use credentials, or claim production readiness.

## In Scope

- Add a production verification gate checker.
- Read one local production verification gate JSON file.
- Reuse the external-write gate checker.
- Require the referenced external-write gate report to be green, gate-only, non-publishing, and non-production.
- Require production verification identity fields:
  - gate id;
  - external-write gate path;
  - owner;
  - recorded time;
  - target version;
  - release action.
- Require verification plan metadata:
  - verification environment;
  - verification window;
  - verification command intent;
  - acceptance criteria;
  - verification path policy.
- Require post-action checks metadata:
  - deployment health check declared;
  - external write verification declared;
  - artifact availability verification declared;
  - rollback verification declared;
  - no check executed by this gate.
- Require monitoring readiness metadata:
  - monitoring owner;
  - alert channel declared;
  - health dashboard declared;
  - incident handoff declared;
  - monitoring not executed by this gate.
- Require incident and rollback readiness metadata:
  - incident owner;
  - rollback owner;
  - rollback trigger declared;
  - escalation path declared;
  - rollback not executed by this gate.
- Require ordered command evidence for external-write gate, release hygiene, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require credential boundary, verification decision, and verification boundary sections.
- Require the verification decision to remain blocked until a future operator execution approval.
- Require the verification boundary to prove verification-only behavior with no command execution, no production verification execution, no connector calls, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.
- Add an npm script, tracked example gate JSON, tests, docs, and memory updates.

## Out of Scope

- Execute production verification commands.
- Publish, create tags, build packages, upload artifacts, deploy, or create releases.
- Call connectors, external APIs, webhooks, platform CLIs, or account sessions.
- Perform external writes or store writes.
- Use credentials, tokens, SSH keys, environment secrets, or account sessions.
- Mutate playbooks, fixtures, runtime stores, business assets, or release evidence.
- Claim production readiness.
- Replace a future final release execution approval gate or post-execution production evidence gate.

## Contract

Input gate JSON:

- `gateId`
- `externalWriteGatePath`
- `owner`
- `recordedAt`
- `targetVersion`
- `releaseAction: "production_verification"`
- `externalWriteGateResult`
- `verificationPlan`
- `postActionChecks`
- `monitoringReadiness`
- `incidentRollbackReadiness`
- `commandEvidence`
- `credentialBoundary`
- `verificationDecision`
- `verificationBoundary`
- `approvalStatus: "production_verification_gate_review"`
- `notes`

Output report:

- `ok`
- `command: "release:production-verification:gate:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `verificationOnly: true`
- `readyForReleaseExecutionApprovalReview`
- `productionVerificationClaim: "production_verification_requirements_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid production verification gate referencing the tracked external-write gate passes.
- The gate fails if the referenced external-write gate report is not green, gate-only, non-publishing, or non-production.
- The gate fails if identity fields, owner, target version, or release action are missing or malformed.
- The gate fails if verification plan metadata is missing or records an approved verification path.
- The gate fails if post-action checks are missing or record checks executed by this gate.
- The gate fails if monitoring readiness or incident/rollback readiness metadata is missing.
- The gate fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- The gate fails if credential boundary, verification decision, or verification boundary are missing.
- The gate fails if verification decision approves execution, records verification execution, allows release execution, allows external writes, allows store writes, or allows credential use.
- The gate fails if verification boundary records command execution, production verification execution, connector calls, external writes, store writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid gates and `1` for invalid gates.

## Next Boundary

After this gate is green, the next separate phase can design the release execution approval boundary. Actual release execution, production verification execution, connector calls, external writes, credential use, and production readiness claims remain blocked until future explicit operator approval and post-execution evidence gates exist.
