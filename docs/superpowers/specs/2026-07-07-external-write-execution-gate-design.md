# External-Write Execution Gate Design

## Goal

Add a local read-only external-write execution gate after a green deployment execution gate.

The gate validates that a future external write has enough structured review evidence before any connector, platform CLI, API, or store write can be considered. It does not call connectors, perform external writes, write stores, deploy, use credentials, or claim production readiness.

## In Scope

- Add an external-write execution gate checker.
- Read one local external-write gate JSON file.
- Reuse the deployment gate checker.
- Require the referenced deployment gate report to be green, gate-only, non-publishing, and non-production.
- Require external-write gate identity fields:
  - gate id;
  - deployment gate path;
  - owner;
  - recorded time;
  - target version;
  - release action.
- Require external write request metadata:
  - target system;
  - write intent;
  - write command;
  - write payload;
  - write path policy.
- Require external system review metadata:
  - target system reviewed;
  - write scope reviewed;
  - payload reviewed;
  - idempotency reviewed;
  - rollback target reviewed.
- Require idempotency policy metadata:
  - idempotency required;
  - idempotency key declared;
  - duplicate write handling declared;
  - retry policy documented;
  - no idempotency check executed by this gate.
- Require ordered command evidence for deployment gate, release hygiene, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require rollback plan, monitoring plan, credential boundary, external write decision, and external write boundary sections.
- Require the external write decision to remain blocked until a future operator execution approval.
- Require the external write boundary to prove gate-only behavior with no connector calls, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.
- Add an npm script, tracked example gate JSON, tests, docs, and memory updates.

## Out of Scope

- Call external connectors, GitHub APIs, release APIs, publishing APIs, deployment APIs, webhook endpoints, or platform CLIs.
- Perform external writes or store writes.
- Use credentials, tokens, SSH keys, environment secrets, or account sessions.
- Deploy, upload artifacts, create tags, create releases, publish, or mutate infrastructure.
- Mutate playbooks, fixtures, runtime stores, business assets, or release evidence.
- Execute the recorded write command.
- Claim production readiness.
- Replace future external-write execution approval, external write verification, monitoring, incident, rollback, deployment verification, or production readiness gates.

## Contract

Input gate JSON:

- `gateId`
- `deploymentGatePath`
- `owner`
- `recordedAt`
- `targetVersion`
- `releaseAction: "external_write"`
- `deploymentGateResult`
- `externalWriteRequest`
- `externalSystemReview`
- `idempotencyPolicy`
- `commandEvidence`
- `rollbackPlan`
- `monitoringPlan`
- `credentialBoundary`
- `externalWriteDecision`
- `externalWriteBoundary`
- `approvalStatus: "external_write_execution_gate_review"`
- `notes`

Output report:

- `ok`
- `command: "release:external-write:gate:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `gateOnly: true`
- `readyForExternalWriteOperatorReview`
- `externalWriteGateClaim: "external_write_execution_gate_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid external-write gate referencing the tracked deployment gate passes.
- The gate fails if the referenced deployment gate report is not green, gate-only, non-publishing, or non-production.
- The gate fails if identity fields, owner, target version, or release action are missing or malformed.
- The gate fails if external write request metadata is missing or records an approved write path.
- The gate fails if external system review metadata is missing.
- The gate fails if idempotency policy metadata is missing or records checks executed by this gate.
- The gate fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- The gate fails if rollback plan, monitoring plan, credential boundary, or external write boundary are missing.
- The gate fails if external write decision approves execution, records external writes, allows store writes, allows connector calls, or allows credential use.
- The gate fails if external write boundary records connector calls, external writes, store writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid gates and `1` for invalid gates.

## Next Boundary

After this gate is green, the next separate phase can design production verification and release execution approval boundaries. External writes themselves remain blocked until a future explicit operator execution approval and post-write verification gate exist.
