# Trace Fixture Generation And Replay Design

## Context

Trace governance now has two safe boundaries:

- `buildControlledTraceArtifact(run)` creates a governed artifact that redacts raw step input/output, tool outputs, approval feedback, audit messages, run/step errors, plan goal, and step descriptions.
- Runtime Console can copy `{ export, artifact }` from the local `trace-artifact` route.

The next reliability step is to turn governed artifacts into test fixtures. This should not replay real tool calls yet. The first slice should create a compact, stable fixture that proves playbook shape, step order, approval/schema/writeback metadata, and governance redaction boundaries.

## Goals

- Add a fixture builder that accepts only `ControlledTraceArtifact`.
- Produce a stable fixture shape safe to commit into tests.
- Preserve replay-relevant metadata:
  - source run id,
  - playbook id / version,
  - plan id,
  - scenario id,
  - workflow run id,
  - terminal state,
  - ordered step ids,
  - step states / attempts,
  - approval states,
  - schema validation valid flags,
  - writeback target metadata,
  - audit event types.
- Add validation that checks:
  - artifact came through trace governance,
  - step input/output are redacted,
  - tool outputs are redacted,
  - plan step order matches artifact step order when plan is present,
  - known playbook step order matches fixture step order when playbook is registered.
- Add tests that prove raw customer content and secrets cannot enter fixture JSON.

## Non-Goals

- No real LLM/tool replay in this slice.
- No Runtime Console UI changes.
- No file upload/import flow.
- No automatic fixture generation from stored runs.
- No changes to raw controlled run storage.
- No semantic validation of business content inside redacted summaries.

## Proposed Design

Add:

`src/lib/executor/runtime/trace-fixtures.ts`

Exports:

- `ControlledTraceFixture`
- `ControlledTraceFixtureStep`
- `ControlledTraceFixtureValidationResult`
- `buildControlledTraceFixture(artifact, options?)`
- `validateControlledTraceFixture(fixture)`

### Fixture Shape

```ts
type ControlledTraceFixture = {
  schemaVersion: "controlled-trace-fixture/v1";
  fixtureId: string;
  sourceRunId: string;
  playbookId: string;
  playbookVersion: string;
  planId: string;
  scenarioId?: string;
  workflowRunId?: string;
  terminalState: ControlledExecutionRunState;
  generatedAt: number;
  governance: {
    mode: ControlledTraceGovernanceMode;
    redactedAt: number;
  };
  plan?: {
    id: string;
    totalSteps: number;
    requiresApproval: boolean;
    stepOrder: string[];
  };
  steps: ControlledTraceFixtureStep[];
  auditEventTypes: string[];
  assertions: {
    stepOrder: string[];
    redactionBoundary: "required";
    knownPlaybookMatched: boolean;
  };
};
```

Step fixture:

```ts
type ControlledTraceFixtureStep = {
  stepId: string;
  state: ControlledExecutionStepState;
  attempts: number;
  hasRedactedInput: boolean;
  hasRedactedOutput: boolean;
  toolCalls: Array<{
    toolName: string;
    success: boolean;
    durationMs?: number;
    tokensUsed?: number;
    outputRedacted: boolean;
  }>;
  approvalState?: string;
  schemaValid?: boolean;
  writebackTargets: Array<{
    target: string;
    ok: boolean;
    assetId?: string;
    sourceKey?: string;
    workflowRunId?: string;
  }>;
};
```

### Validation

`validateControlledTraceFixture(fixture)` returns:

```ts
{
  ok: boolean;
  errors: string[];
}
```

Checks:

- schema version is supported.
- fixture has source run and playbook ids.
- every step has a `stepId`.
- every step has redacted input and output.
- every tool call output is redacted.
- `assertions.stepOrder` matches `steps.map(step => step.stepId)`.
- if `knownPlaybookMatched` is true, the known playbook step order must match.

`buildControlledTraceFixture()` should set `knownPlaybookMatched` by looking up the playbook id in the catalog and comparing its step ids to artifact step ids.

### Sample Fixture

Add a small JSON fixture under:

`src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json`

This fixture should be generated from a governed artifact-like object in test code, not from a raw run file. It must not contain raw customer names, emails, API keys, bearer tokens, or draft bodies.

## Testing

Add:

- `src/__tests__/lib/executor/runtime/trace-fixtures.test.ts`

Coverage:

- builds a fixture from a governed sales artifact.
- preserves step order, approval state, schema flag, and writeback target metadata.
- marks known playbook match for `sales-pipeline-v1` when all playbook steps are present.
- validates fixture successfully.
- rejects fixtures with non-redacted step input/output.
- proves serialized fixture does not contain raw customer content or secrets.

Update `test:controlled-runtime` to include the new fixture tests.

## Acceptance Criteria

- A governed trace artifact can be converted into a stable fixture.
- Fixture validation catches missing redaction boundaries.
- Known playbook step order can be checked without invoking tools.
- Fixture JSON is safe to commit.
- Existing controlled runtime, core workflows, lint, build, and diff checks pass.
