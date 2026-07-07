# Production Release Completion Evidence Boundary Design

## Purpose

Add the missing post-execution boundary after `release:execution-approval:check`.

The new boundary must let maintainers validate a structured evidence packet after a human/operator has executed release actions outside the checker. It must not execute those actions itself. It must make the distinction between an example/schema packet and an actual operator-recorded production completion packet explicit.

## Current Context

The release chain currently ends at the release execution approval boundary:

```bash
npm run release:execution-approval:check -- --approval docs/release-execution-approvals/example-release-execution-approval-boundary.json
```

That checker is intentionally non-executing. It validates final approval requirements and preserves:

- `productionReady: false`
- `publishingPerformed: false`
- `approvalBoundaryOnly: true`

The next gap is not "skip approvals and release automatically". The next gap is: after an operator has manually executed package build, tag creation, artifact upload, deployment, external writes, and production verification, the project needs a local, machine-readable way to validate the resulting evidence.

## Non-Goals

This phase must not:

- build packages;
- create tags;
- upload artifacts;
- deploy;
- call connectors;
- perform external writes;
- write stores;
- use credentials;
- run production verification;
- publish a GitHub Release;
- declare the current repository actually production-ready based on an example packet.

## Proposed Interface

Add:

```bash
npm run release:completion:evidence:check -- --evidence <path>
```

The command reads one local JSON evidence packet and returns machine-readable JSON.

## Evidence Contract

Required top-level fields:

- `evidenceId`
- `releaseExecutionApprovalPath`
- `owner`
- `recordedAt`
- `targetVersion`
- `evidenceScope: "production_release_completion_evidence"`
- `evidenceMode`
- `releaseExecutionApprovalResult`
- `operatorExecutionSummary`
- `releaseActionEvidence`
- `credentialUseEvidence`
- `postExecutionVerification`
- `monitoringEvidence`
- `rollbackEvidence`
- `auditTrail`
- `completionBoundary`
- `completionStatus`

Allowed evidence modes:

- `example_schema_only`: validates the packet shape and boundary, but must not claim actual production completion.
- `operator_recorded_actual_execution`: may validate to a real completion claim only when every action and post-execution evidence item is green.

Required release actions:

- `packageBuild`
- `tagCreation`
- `artifactUpload`
- `deployment`
- `externalWrites`
- `productionVerification`

For actual completion evidence, every action must record:

- `performed: true`
- `ok: true`
- `executedBy`
- `executedAt`
- `commandOrProcedure`
- `evidenceRef`
- `rollbackAvailable: true`
- `monitoringLinked: true`

For example/schema-only evidence, actions may describe expected fields but must record `performed: false`.

## Upstream Reuse

The CLI must reuse `buildReleaseExecutionApprovalCheckCliResult()` and require the referenced approval boundary to be green:

- `ok: true`
- `readyForManualReleaseExecutionDecisionReview: true`
- `releaseExecutionApprovalClaim: "release_execution_approval_boundary_defined"`
- `approvalBoundaryOnly: true`
- `productionReady: false`
- `publishingPerformed: false`

## Output Semantics

For a valid `example_schema_only` packet:

- `ok: true`
- `completionEvidenceOnly: true`
- `schemaExampleOnly: true`
- `productionReleaseCompleted: false`
- `productionReady: false`
- `publishingPerformed: false`
- `status: "production_release_completion_evidence_schema_ready"`

For a valid `operator_recorded_actual_execution` packet:

- `ok: true`
- `completionEvidenceOnly: true`
- `schemaExampleOnly: false`
- `productionReleaseCompleted: true`
- `productionReady: true`
- `publishingPerformed: true`
- `status: "production_release_completed_by_operator_evidence"`
- `releaseCompletionClaim: "production_release_completed_by_operator_evidence"`

The checker must make clear that the checker did not perform the release:

- `checkerExecutedReleaseActions: false`
- `checkerUsedCredentials: false`

## Failure Behavior

The validator must fail closed on:

- invalid or non-green release execution approval evidence;
- missing identity or invalid scope;
- unsupported evidence mode;
- example packets claiming performed production actions;
- actual packets with any missing action evidence;
- credential evidence that omits approver, scope, or redaction policy;
- missing post-execution production verification result;
- missing monitoring links;
- missing rollback evidence;
- audit trail gaps;
- boundary metadata claiming the checker performed actions or used credentials.

## Tests

Add tests for:

- valid example/schema-only evidence remains non-production;
- valid actual operator-recorded evidence can report production completion;
- invalid upstream release execution approval fails closed;
- example evidence that claims performed actions is rejected;
- actual evidence with missing action evidence is rejected;
- CLI parses `--evidence` and `--compact`;
- CLI rejects invalid JSON.

## Documentation

Update project docs to state that the release chain now has a post-execution evidence boundary. Continue to state that the repository has not performed production release actions through the checker. Actual production completion requires an operator-recorded evidence packet from real external execution.

## Self-Review

- Scope is one checker plus one example packet and docs.
- The design does not grant credentials, external writes, deployment, tag creation, packaging, artifact upload, or publishing authority.
- The example packet cannot accidentally claim production readiness because `evidenceMode` is `example_schema_only`.
- Actual production completion output is possible only from a separate `operator_recorded_actual_execution` evidence packet.
