# Tag Creation Execution Gate Design

## Goal

Add a local read-only tag creation execution gate after a green package build execution gate.

The gate validates that tag creation has enough structured review evidence before any real tag command can be considered. It does not run `git tag`, push tags, create release records, upload artifacts, deploy, call external connectors, write stores, use credentials, or claim production readiness.

## In Scope

- Add a tag creation execution gate checker.
- Read one local tag creation gate JSON file.
- Reuse the package build gate checker.
- Require the referenced package build gate report to be green, gate-only, non-publishing, and non-production.
- Require tag creation gate identity fields:
  - gate id;
  - package build gate path;
  - owner;
  - recorded time;
  - target version;
  - release action.
- Require tag request metadata:
  - tag name;
  - tag target commit;
  - source branch;
  - tag type;
  - tag message policy.
- Require tag policy review metadata:
  - tag name matches version;
  - annotated tag required;
  - changelog linkage reviewed;
  - release notes linkage reviewed;
  - existing tag collision checked;
  - no tag collision found.
- Require source commit evidence metadata:
  - target commit recorded;
  - source branch recorded;
  - working tree diff gate recorded separately;
  - current branch policy documented.
- Require ordered command evidence for package build gate, release hygiene, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require changelog / release note linkage, rollback plan, monitoring plan, credential boundary, tag creation decision, and tag creation boundary sections.
- Require tag creation decision to remain blocked until a future operator execution approval.
- Require the tag creation boundary to prove gate-only behavior with no tag creation, no tag push, no release creation, no artifact upload, no deployment, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.
- Add an npm script, tracked example gate JSON, tests, docs, and memory updates.

## Out of Scope

- Run `git tag`, `git push --tags`, GitHub Release commands, or any tag creation command.
- Create local or remote tags.
- Create release records.
- Upload artifacts.
- Deploy to any environment.
- Call external connectors or use credentials.
- Mutate playbooks, fixtures, stores, business assets, or release evidence.
- Publish a release.
- Claim production readiness.
- Replace future tag creation execution approval, artifact upload, deployment, monitoring, incident, or rollback execution gates.

## Contract

Input gate JSON:

- `gateId`
- `packageBuildGatePath`
- `owner`
- `recordedAt`
- `targetVersion`
- `releaseAction: "tag_creation"`
- `packageBuildGateResult`
- `tagRequest`
- `tagPolicyReview`
- `sourceCommitEvidence`
- `commandEvidence`
- `releaseNotesLinkage`
- `rollbackPlan`
- `monitoringPlan`
- `credentialBoundary`
- `tagCreationDecision`
- `tagCreationBoundary`
- `approvalStatus: "tag_creation_execution_gate_review"`
- `notes`

Output report:

- `ok`
- `command: "release:tag-creation:gate:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `gateOnly: true`
- `readyForTagCreationOperatorReview`
- `tagCreationGateClaim: "tag_creation_execution_gate_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid tag creation gate referencing the tracked package build gate passes.
- The gate fails if the referenced package build gate report is not green, gate-only, non-publishing, or non-production.
- The gate fails if identity fields, owner, target version, or release action are missing or malformed.
- The gate fails if tag request metadata is missing or does not match the target version.
- The gate fails if tag policy review metadata is missing or records a collision.
- The gate fails if source commit evidence is missing.
- The gate fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- The gate fails if release notes linkage, rollback plan, monitoring plan, credential boundary, or tag creation boundary are missing.
- The gate fails if tag creation decision approves execution, records tag creation, allows push, or allows credential use.
- The gate fails if tag creation boundary records created tags, pushed tags, release creation, artifact upload, deployment, external writes, store writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid gates and `1` for invalid gates.

## Next Boundary

After this gate is green, the next separate phase can design the artifact upload execution gate. Tag creation itself still remains blocked until a future explicit operator execution approval and tag verification gate exist.
