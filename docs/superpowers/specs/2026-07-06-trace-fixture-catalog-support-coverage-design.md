# Trace Fixture Catalog And Support Coverage Design

## Context

Phase 10d added `replayControlledTraceFixture()`, which validates a single governed fixture against the current controlled playbook catalog without executing tools or writing assets. The project now has two controlled playbooks, but only the sales fixture is committed and replayed.

The next reliability step is to make committed fixtures enumerable and add support playbook coverage. This should remain a pure regression layer: no runtime stores, no API routes, no LLM calls, no tool execution, and no generated fixture pipeline.

## Goals

- Add a typed catalog for committed governed trace fixtures.
- Keep the catalog explicit so fixture inclusion is reviewed in code.
- Add a committed governed fixture for `support-resolution-v1`.
- Replay every catalog fixture in one regression test.
- Keep existing sales replay tests focused on mismatch behavior.
- Include the catalog replay test in `test:controlled-runtime`.

## Non-Goals

- No automatic filesystem fixture discovery.
- No route for fixture generation.
- No LLM/tool replay.
- No runtime store reads or writes.
- No fixture mutation from live controlled runs.
- No UI changes.

## Proposed Design

Add:

`src/__tests__/fixtures/controlled-traces/catalog.ts`

Exports:

```ts
import salesPipelineFixture from "./sales-pipeline-governed.fixture.json";
import supportResolutionFixture from "./support-resolution-governed.fixture.json";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

export type ControlledTraceFixtureCatalogEntry = {
  id: string;
  playbookId: string;
  fixture: ControlledTraceFixture;
};

export const controlledTraceFixtureCatalog: ControlledTraceFixtureCatalogEntry[] = [
  {
    id: "sales-pipeline-governed",
    playbookId: "sales-pipeline-v1",
    fixture: salesPipelineFixture as ControlledTraceFixture,
  },
  {
    id: "support-resolution-governed",
    playbookId: "support-resolution-v1",
    fixture: supportResolutionFixture as ControlledTraceFixture,
  },
];
```

Add:

`src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json`

The fixture should mirror the current `support-resolution-v1` playbook contract:

- `intake` writes `workflow_run`.
- `classify` writes `support_asset`.
- `draft_reply` writes `draft`.
- `human_review` has `approvalState: "approved"` and writes `workflow_run`.
- `writeback` has `approvalState: "approved"` and writes `support_asset`, `knowledge_asset`, and `workflow_run`.

The fixture must contain only redaction flags and structured metadata. It must not contain customer names, email addresses, message bodies, API keys, bearer tokens, or raw issue text.

## Testing

Add:

`src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`

Coverage:

- Catalog contains the sales and support fixture entries.
- Every catalog entry fixture `playbookId` matches the entry `playbookId`.
- Every catalog fixture passes `validateControlledTraceFixture()`.
- Every catalog fixture passes `replayControlledTraceFixture()`.
- Serialized catalog fixtures do not contain known raw customer content or secret markers.

Update `test:controlled-runtime` to include:

`src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`

## Acceptance Criteria

- Sales and support governed fixtures both replay successfully from the catalog.
- Adding or changing a playbook contract causes catalog replay failure when fixture metadata drifts.
- The catalog remains explicit and reviewable.
- Existing controlled runtime, core workflows, lint, build, and diff checks pass.
