# Deployment Execution Gate Design

## Goal

Add a local read-only deployment execution gate after a green artifact upload execution gate.

The gate validates that deployment has enough structured review evidence before any real deploy command can be considered. It does not deploy, upload, create releases, call external connectors, write stores, use credentials, or claim production readiness.

## In Scope

- Add a deployment execution gate checker.
- Read one local deployment gate JSON file.
- Reuse the artifact upload gate checker.
- Require the referenced artifact upload gate report to be green, gate-only, non-publishing, and non-production.
- Require deployment gate identity fields:
  - gate id;
  - artifact upload gate path;
  - owner;
  - recorded time;
  - target version;
  - release action.
- Require deployment request metadata:
  - environment;
  - deployment target;
  - deployment command;
  - deployment artifact;
  - deployment strategy;
  - deployment path policy.
- Require deployment environment review metadata:
  - environment reviewed;
  - target reviewed;
  - artifact linkage reviewed;
  - rollback window reviewed;
  - maintenance window reviewed.
- Require pre-deployment check metadata:
  - health check declared;
  - config review documented;
  - migration impact reviewed;
  - smoke path declared;
  - no check executed by this gate.
- Require ordered command evidence for artifact upload gate, release hygiene, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require rollback plan, monitoring plan, credential boundary, deployment decision, and deployment boundary sections.
- Require deployment decision to remain blocked until a future operator execution approval.
- Require the deployment boundary to prove gate-only behavior with no deployment, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.
- Add an npm script, tracked example gate JSON, tests, docs, and memory updates.

## Out of Scope

- Run deployment commands such as cloud CLIs, hosting CLIs, SSH deploys, rsync deploys, or connector deploys.
- Upload artifacts.
- Create release records.
- Mutate infrastructure, stores, business assets, fixtures, or playbooks.
- Call external connectors or use credentials.
- Publish a release.
- Claim production readiness.
- Replace future deployment execution approval, deployment verification, monitoring, incident, rollback, or external-write execution gates.

## Contract

Input gate JSON:

- `gateId`
- `artifactUploadGatePath`
- `owner`
- `recordedAt`
- `targetVersion`
- `releaseAction: "deployment"`
- `artifactUploadGateResult`
- `deploymentRequest`
- `deploymentEnvironmentReview`
- `preDeploymentChecks`
- `commandEvidence`
- `rollbackPlan`
- `monitoringPlan`
- `credentialBoundary`
- `deploymentDecision`
- `deploymentBoundary`
- `approvalStatus: "deployment_execution_gate_review"`
- `notes`

Output report:

- `ok`
- `command: "release:deployment:gate:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `gateOnly: true`
- `readyForDeploymentOperatorReview`
- `deploymentGateClaim: "deployment_execution_gate_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid deployment gate referencing the tracked artifact upload gate passes.
- The gate fails if the referenced artifact upload gate report is not green, gate-only, non-publishing, or non-production.
- The gate fails if identity fields, owner, target version, or release action are missing or malformed.
- The gate fails if deployment request metadata is missing or records an approved deployment path.
- The gate fails if deployment environment review metadata is missing.
- The gate fails if pre-deployment check metadata is missing or records checks executed by this gate.
- The gate fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- The gate fails if rollback plan, monitoring plan, credential boundary, or deployment boundary are missing.
- The gate fails if deployment decision approves execution, records deployment, allows external writes, or allows credential use.
- The gate fails if deployment boundary records deployment, external writes, store writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid gates and `1` for invalid gates.

## Next Boundary

After this gate is green, the next separate phase can design the external-write execution gate. Deployment itself remains blocked until a future explicit operator execution approval and deployment verification gate exist.
