# Trace Fixture Replay Runner Design

## Context

Trace governance now produces redacted artifacts, and Phase 10c turns those artifacts into committed fixtures. The remaining gap is a deterministic check that proves a fixture still matches the current controlled playbook contract.

This phase is intentionally not a real replay engine. It should not invoke LLMs, call tools, hit API routes, write assets, mutate stores, or reconstruct business content. It is a contract replay runner: it replays only the fixture metadata against the registered playbook definition.

## Goals

- Add a pure replay validation helper for `ControlledTraceFixture`.
- Reuse `validateControlledTraceFixture()` as the base fixture safety gate.
- Check that the fixture playbook exists in the controlled playbook catalog.
- Check that fixture step order exactly matches the current playbook step order.
- Check that playbook steps requiring approval have an approval state in the fixture.
- Check that playbook `writesTo` targets are represented by fixture writeback targets on the same step.
- Return a structured report that states what was checked and explicitly guarantees no tool execution or asset writes.
- Include the replay test in `test:controlled-runtime`.

## Non-Goals

- No LLM replay.
- No tool invocation.
- No asset writeback.
- No store mutation.
- No API route or Runtime Console changes.
- No semantic checking of redacted business content.
- No migration of old fixtures.

## Proposed Design

Add:

`src/lib/executor/runtime/trace-replay.ts`

Exports:

- `ControlledTraceReplayReport`
- `replayControlledTraceFixture(fixture)`

Report shape:

```ts
type ControlledTraceReplayReport = {
  ok: boolean;
  fixtureId: string;
  playbookId: string;
  checkedStepIds: string[];
  errors: string[];
  warnings: string[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};
```

Validation rules:

- Run `validateControlledTraceFixture(fixture)` first and include its errors.
- Look up `fixture.playbookId` through `getControlledPlaybook()`.
- If the playbook is missing, return an error and skip playbook contract checks.
- Compare `fixture.steps.map(step => step.stepId)` with `playbook.steps.map(step => step.id)`.
- For every playbook step where `requiresApproval` is `true`, require a fixture step with a non-empty `approvalState`.
- For every playbook step `writesTo` target, require a matching fixture `writebackTargets` entry on the same step.
- `checkedStepIds` should report the fixture step ids inspected by the runner.
- `guarantees.toolCallsExecuted` and `guarantees.assetsWritten` must always be `false`.

## Error Messages

Use stable messages so fixture failures are useful in tests and reviews:

- `Fixture validation failed: <error>`
- `Controlled playbook <playbookId> is not registered`
- `Fixture step order does not match current playbook <playbookId>`
- `Step <stepId> requires approval but fixture has no approval state`
- `Step <stepId> is missing writeback target <target>`

## Testing

Add:

`src/__tests__/lib/executor/runtime/trace-replay.test.ts`

Coverage:

- The committed sales fixture replays successfully without executing tools or writing assets.
- A fixture with mismatched step order fails.
- A fixture missing required approval state fails.
- A fixture missing an expected writeback target fails.
- A fixture with an unknown playbook id fails.

Update `test:controlled-runtime` to include the replay tests.

## Acceptance Criteria

- Committed governed fixtures can be replay-validated against current playbook contracts.
- Replay reports contain deterministic errors and explicit non-execution guarantees.
- The replay runner remains pure and does not import runtime stores, route handlers, tool executors, or writeback functions.
- Existing controlled runtime, core workflows, lint, build, and diff checks pass.
