# Release Execution Planning Gates Design

## Goal

Add a local read-only release execution planning gate after a green production release approval packet.

The gate validates that packaging, tag creation, artifact upload, deployment, and external writes have a structured execution plan before any real release action can be considered. It does not build packages, create tags, upload artifacts, deploy, call external connectors, write stores, use credentials, or claim production readiness.

## In Scope

- Add a release execution plan checker.
- Read one local execution plan JSON file.
- Reuse the production release approval checker.
- Require the referenced approval packet report to be green, approval-packet-only, non-publishing, and non-production.
- Require execution plan identity fields:
  - plan id;
  - approval path;
  - owner;
  - recorded time;
  - target version;
  - approval status.
- Require explicit planned action entries for:
  - packaging;
  - tag creation;
  - artifact upload;
  - deployment;
  - external writes.
- Require every planned action to declare owner, gate, command intent, rollback step, monitoring step, and still be unexecuted and unapproved for execution.
- Require command evidence for production approval, production policy, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require release execution preconditions, rollback plan, monitoring plan, credential boundary, and execution boundary sections.
- Require the execution boundary to prove planning-only behavior with no publishing, no tag, no package build, no upload, no deployment, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.
- Add an npm script, tracked example execution plan JSON, tests, docs, and memory updates.

## Out of Scope

- Publish anything.
- Create release tags.
- Build installers or packages.
- Upload artifacts.
- Deploy to any environment.
- Call external connectors or use credentials.
- Mutate playbooks, fixtures, stores, business assets, or release evidence.
- Run the commands recorded in the execution plan evidence.
- Approve any action for execution.
- Claim production readiness.
- Replace future package-build, tag-creation, upload, deployment, connector-write, monitoring, incident, or rollback execution gates.

## Contract

Input execution plan JSON:

- `planId`
- `approvalPath`
- `owner`
- `recordedAt`
- `targetVersion`
- `productionReleaseApprovalResult`
- `plannedActions`
- `commandEvidence`
- `preconditions`
- `rollbackPlan`
- `monitoringPlan`
- `credentialBoundary`
- `executionBoundary`
- `approvalStatus: "release_execution_planning"`
- `notes`

Each planned action must include:

- `owner`
- `executionGate`
- `executionCommand`
- `executionCommandDeclared: true`
- `executionGateRequired: true`
- `rollbackStepDocumented: true`
- `monitoringStepDocumented: true`
- `executed: false`
- `approvedForExecution: false`
- `credentialUseAllowed: false`
- `productionReadinessClaimed: false`
- `notes`

Output report:

- `ok`
- `command: "release:execution-plan:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `planningOnly: true`
- `readyForReleaseExecutionGateDesign`
- `executionPlanClaim: "release_execution_plan_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid execution plan referencing the tracked production release approval packet passes.
- The plan fails if the referenced approval packet report is not green, approval-packet-only, non-publishing, or non-production.
- The plan fails if identity fields, owner, target version, or approval status are missing or malformed.
- The plan fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- The plan fails if any release action is missing owner/gate/command/rollback/monitoring metadata.
- The plan fails if any release action is executed, approved for execution, allows credential use, or claims production readiness.
- The plan fails if preconditions, rollback plan, monitoring plan, credential boundary, or execution boundary are missing.
- The plan fails if release boundary records publishing, tag creation, package build, upload, deployment, external writes, store writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid plans and `1` for invalid plans.

## Next Boundary

After this gate is green, the next separate phase can design individual action-family execution gates such as package build execution, tag creation execution, artifact upload execution, deployment execution, and external-write execution. Those gates must remain separate from this planning gate and must still avoid production readiness claims until production verification exists.
