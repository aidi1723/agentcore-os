# Fixture Replay Depth And Golden Invariants Design

## Context

Phase 10d through 10j established governed trace artifacts, fixture generation, pure fixture replay, catalog reporting, a local CI summary command, a fixture builder CLI, and a manual fixture refresh workflow.

The current replay runner proves the largest contract boundaries: the playbook exists, fixture step order matches the current playbook, approval-gated steps carry approval state, and each playbook writeback target appears on the corresponding fixture step. That is enough to catch obvious drift, but not enough to guard the stable metadata that makes fixture replay valuable as a maintenance gate.

Phase 10k deepens replay checks while preserving the same purity boundary. It does not replay tool calls, call APIs, read runtime stores, mutate stores, or write assets.

## Goal

Extend pure governed fixture replay with explicit golden invariants for committed fixture metadata that should remain stable as playbooks evolve.

## Non-Goals

- No LLM replay.
- No tool execution or tool simulation.
- No API route calls.
- No runtime store reads or writes.
- No asset writeback.
- No automatic fixture discovery.
- No automatic committed fixture refresh.
- No fixture JSON rewrite unless a committed fixture is already inconsistent with the intended new invariants.

## Scope

### Replay Contract Checks

`replayControlledTraceFixture()` should continue to call `validateControlledTraceFixture()` first and preserve existing stable `errors` strings.

It should add deeper checks against the current registered playbook:

- fixture `playbookVersion` equals current playbook `version`;
- fixture `scenarioId`, when present, equals current playbook `scenarioId`;
- fixture `plan.id`, when present, equals `playbook:${playbook.id}:${playbook.version}`;
- fixture `plan.totalSteps`, when present, equals current playbook step count;
- fixture `plan.requiresApproval`, when present, equals whether any current playbook step requires approval;
- fixture `plan.stepOrder`, when present, already remains aligned through existing fixture validation and should also be represented in diagnostics;
- each completed fixture step has `attempts >= 1`;
- each approval-gated playbook step in a successful completed fixture uses terminal approval state `approved`;
- each successful writeback receipt for current stable targets carries required stable metadata:
  - `workflow_run`: `assetId`, `sourceKey`, and `workflowRunId`;
  - `draft`: `assetId`, `sourceKey`, and `workflowRunId`;
  - `sales_asset`: `assetId`, `sourceKey`, and `workflowRunId`;
  - `support_asset`: `assetId`, `sourceKey`, and `workflowRunId`;
  - `knowledge_asset`: `assetId`, `sourceKey`, and `workflowRunId`.

These checks apply only to fixture metadata already present in governed fixtures. They do not inspect raw input/output or external store state.

### Diagnostics

`ControlledTraceReplayDiagnostics` should be extended rather than replaced. Existing fields must remain available:

- `fixtureId`;
- `playbookId`;
- `expectedStepOrder`;
- `fixtureStepOrder`;
- `missingApprovalStepIds`;
- `missingWritebackTargets`.

Add structured fields for new invariant failures:

- `expectedPlaybookVersion`;
- `fixturePlaybookVersion`;
- `expectedScenarioId`;
- `fixtureScenarioId`;
- `expectedPlanId`;
- `fixturePlanId`;
- `expectedPlanTotalSteps`;
- `fixturePlanTotalSteps`;
- `expectedPlanRequiresApproval`;
- `fixturePlanRequiresApproval`;
- `planStepOrder`;
- `missingCompletedStepAttempts`;
- `nonApprovedApprovalStepIds`;
- `writebackTargetsMissingStableMetadata`.

The catalog report and CLI can continue to pass diagnostics through without shape-specific changes.

### Tests

Add focused tests in `trace-replay.test.ts`:

- committed sales fixture replay includes the new all-green diagnostics;
- version drift is rejected;
- plan metadata drift is rejected;
- completed step with zero attempts is rejected;
- approval-gated completed step with non-approved approval state is rejected;
- successful writeback target missing stable metadata is rejected.

Keep catalog tests all-green for the committed sales and support fixtures.

## Error Message Policy

Existing replay error strings must remain stable.

New invariant errors should be explicit and deterministic, for example:

- `Fixture playbook version does not match current playbook sales-pipeline-v1`
- `Fixture plan id does not match current playbook sales-pipeline-v1`
- `Fixture plan totalSteps does not match current playbook sales-pipeline-v1`
- `Fixture plan requiresApproval does not match current playbook sales-pipeline-v1`
- `Step writeback completed with no recorded attempts`
- `Step writeback requires approved terminal state but fixture approval state is rejected`
- `Step writeback writeback target sales_asset is missing stable metadata sourceKey`

## Success Criteria

- `replayControlledTraceFixture()` rejects deeper metadata drift without executing side effects.
- Committed sales and support fixtures remain green.
- Catalog report and `npm run trace:fixtures --silent` expose the deeper diagnostics for failures.
- `test:controlled-runtime` includes the new replay coverage.
- Documentation records Phase 10k and points the next phase at the next conservative controlled-runtime slice.

## Review Notes

- The phase is intentionally still metadata-only. It increases confidence in committed governed fixtures without pretending to reproduce the original controlled run.
- Stable writeback metadata is checked because Runtime Console deep links and record focus now depend on these fields.
- Approval terminal state is checked because a completed approval-gated fixture with a rejected or pending approval state would be misleading even if the step order still matches.
