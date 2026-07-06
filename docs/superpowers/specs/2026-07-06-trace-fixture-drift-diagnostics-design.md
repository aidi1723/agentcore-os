# Trace Fixture Drift Diagnostics Design

## Context

Phase 10d added pure fixture replay validation. Phase 10e added an explicit fixture catalog covering sales and support governed fixtures. The current replay errors are stable and useful for assertions, but they are not enough for maintenance when a playbook evolves. A developer needs to see which current playbook contract was expected and which fixture metadata is stale.

This phase keeps replay pure. It only enriches `ControlledTraceReplayReport` with structured diagnostics.

## Goals

- Add structured drift diagnostics to `ControlledTraceReplayReport`.
- Preserve the existing `errors` array and its stable messages.
- Include enough metadata to update stale fixtures quickly:
  - fixture id,
  - playbook id,
  - expected step order,
  - fixture step order,
  - missing approval step ids,
  - missing writeback targets.
- Keep successful replay reports explicit and empty for drift diagnostics.
- Keep catalog replay tests green.

## Non-Goals

- No LLM replay.
- No tool invocation.
- No runtime store reads or writes.
- No API route changes.
- No fixture generation or mutation.
- No UI changes.
- No change to existing error message strings.

## Proposed Design

Extend:

`src/lib/executor/runtime/trace-replay.ts`

Add:

```ts
export type ControlledTraceReplayMissingWritebackTarget = {
  stepId: string;
  target: ControlledPlaybookWriteTarget;
};

export type ControlledTraceReplayDiagnostics = {
  fixtureId: string;
  playbookId: string;
  expectedStepOrder: string[];
  fixtureStepOrder: string[];
  missingApprovalStepIds: string[];
  missingWritebackTargets: ControlledTraceReplayMissingWritebackTarget[];
};
```

Extend `ControlledTraceReplayReport`:

```ts
diagnostics: ControlledTraceReplayDiagnostics;
```

Diagnostics behavior:

- Always include diagnostics, even on success.
- For unregistered playbooks:
  - `expectedStepOrder: []`
  - `fixtureStepOrder: fixture.steps.map(step => step.stepId)`
  - `missingApprovalStepIds: []`
  - `missingWritebackTargets: []`
- For registered playbooks:
  - `expectedStepOrder` uses current playbook step ids.
  - `fixtureStepOrder` uses fixture step ids.
  - `missingApprovalStepIds` includes every playbook step with `requiresApproval` that has no fixture `approvalState`.
  - `missingWritebackTargets` includes every missing playbook `writesTo` target on the same fixture step.

`errors` should still be produced from the same conditions as Phase 10d.

## Testing

Modify:

`src/__tests__/lib/executor/runtime/trace-replay.test.ts`

Coverage:

- Successful sales fixture report includes empty missing diagnostics and matching expected / fixture step order.
- Step order drift report includes expected and fixture step orders.
- Missing approval state report includes `missingApprovalStepIds`.
- Missing writeback target report includes `{ stepId, target }`.
- Unknown playbook report includes empty expected order and fixture order.

No changes are needed to the fixture catalog tests except ensuring they still pass with the extended report shape.

## Acceptance Criteria

- Existing replay `errors` remain stable.
- Drift reports expose structured expected/current data.
- Catalog replay still passes for all committed fixtures.
- Existing controlled runtime, core workflows, lint, build, and diff checks pass.
