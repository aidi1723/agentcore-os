# Package Build Execution Gate Design

## Goal

Add a local read-only package build execution gate after a green release execution plan.

The gate validates that package build execution has enough structured review evidence before any real package build can be considered. It does not run `desktop:package`, build installers, create artifacts, create tags, upload artifacts, deploy, call external connectors, write stores, use credentials, or claim production readiness.

## In Scope

- Add a package build execution gate checker.
- Read one local package build gate JSON file.
- Reuse the release execution plan checker.
- Require the referenced release execution plan report to be green, planning-only, non-publishing, and non-production.
- Require package build gate identity fields:
  - gate id;
  - execution plan path;
  - owner;
  - recorded time;
  - target version;
  - release action.
- Require package build request metadata:
  - package command;
  - package target;
  - artifact type;
  - output path policy;
  - build environment note.
- Require source and supply-chain review metadata:
  - GPLv3+ license review;
  - package script review;
  - lockfile review;
  - dependency provenance review;
  - tracked artifact boundary review.
- Require ordered command evidence for release execution plan, release hygiene, controlled-runtime, core workflows, lint, build, and `git diff --check`.
- Require rollback plan, monitoring plan, artifact handling plan, credential boundary, and package build boundary sections.
- Require package build decision to remain blocked until a future operator execution approval.
- Require the package build boundary to prove gate-only behavior with no package build, no generated artifacts, no publishing, no tag, no upload, no deployment, no external writes, no store writes, no credential use, no production readiness, and no production-readiness claim.
- Add an npm script, tracked example gate JSON, tests, docs, and memory updates.

## Out of Scope

- Run `npm run desktop:package` or any package build command.
- Build installers or packages.
- Create, write, hash, move, or upload package artifacts.
- Create release tags.
- Deploy to any environment.
- Call external connectors or use credentials.
- Mutate playbooks, fixtures, stores, business assets, or release evidence.
- Publish a release.
- Claim production readiness.
- Replace future package build execution approval, artifact verification, upload, deployment, monitoring, incident, or rollback execution gates.

## Contract

Input gate JSON:

- `gateId`
- `executionPlanPath`
- `owner`
- `recordedAt`
- `targetVersion`
- `releaseAction: "packaging"`
- `releaseExecutionPlanResult`
- `packageBuildRequest`
- `sourceReview`
- `commandEvidence`
- `rollbackPlan`
- `monitoringPlan`
- `artifactHandling`
- `credentialBoundary`
- `packageBuildBoundary`
- `packageBuildDecision`
- `approvalStatus: "package_build_execution_gate_review"`
- `notes`

Output report:

- `ok`
- `command: "release:package-build:gate:check"`
- `productionReady: false`
- `publishingPerformed: false`
- `gateOnly: true`
- `readyForPackageBuildOperatorReview`
- `packageBuildGateClaim: "package_build_execution_gate_defined"` only when green
- `status`
- `checks`
- `findings`
- `nextCommand`
- `nextAction`

## Acceptance Criteria

- A valid package build gate referencing the tracked release execution plan passes.
- The gate fails if the referenced release execution plan report is not green, planning-only, non-publishing, or non-production.
- The gate fails if identity fields, owner, target version, or release action are missing or malformed.
- The gate fails if package build request metadata is missing.
- The gate fails if source/supply-chain review metadata is missing or false.
- The gate fails if command evidence entries are missing, out of order, non-green, or missing required metadata.
- The gate fails if rollback plan, monitoring plan, artifact handling, credential boundary, or package build boundary are missing.
- The gate fails if package build decision approves execution, records package execution, or allows credential use.
- The gate fails if package build boundary records generated artifacts, package build, publishing, tag creation, upload, deployment, external writes, store writes, credential use, production readiness, or readiness claim.
- The CLI returns exit code `0` for valid gates and `1` for invalid gates.

## Next Boundary

After this gate is green, the next separate phase can design the tag creation execution gate. Package build itself still remains blocked until a future explicit operator execution approval and artifact verification gate exist.
