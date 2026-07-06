# Trace Fixture Catalog Report Design

## Context

Phase 10e added an explicit governed trace fixture catalog for sales and support fixtures. Phase 10f enriched replay reports with structured drift diagnostics. The catalog test now proves every committed fixture can validate and replay against the current playbook contracts, but there is no reusable aggregate report object for CI, future scripts, or maintenance tooling.

This phase keeps the same pure metadata boundary. It aggregates existing fixture validation and replay output across the explicit catalog without discovering files, invoking tools, calling routes, reading runtime stores, or writing assets.

## Goals

- Add a pure trace fixture catalog report helper.
- Report health for every explicit catalog entry in one object.
- Preserve per-fixture validation errors, replay errors, warnings, diagnostics, and non-execution guarantees.
- Include aggregate counts:
  - total fixtures,
  - passed fixtures,
  - failed fixtures,
  - fixture ids,
  - playbook ids.
- Make the existing catalog test assert the aggregate report for the all-green committed catalog.
- Add synthetic drift coverage that proves the aggregate report preserves Phase 10f diagnostics for a failing fixture.

## Non-Goals

- No LLM replay.
- No tool execution.
- No API routes.
- No CLI command.
- No automatic filesystem discovery.
- No runtime store reads or writes.
- No asset writeback.
- No fixture generation or mutation.
- No UI changes.

## Proposed Design

Create:

`src/__tests__/fixtures/controlled-traces/catalog-report.ts`

The helper lives beside the explicit fixture catalog because it consumes test fixture metadata and should not become a production runtime dependency yet.

Types:

```ts
export type ControlledTraceFixtureCatalogReportItem = {
  catalogId: string;
  fixtureId: string;
  playbookId: string;
  ok: boolean;
  validation: ControlledTraceFixtureValidationResult;
  replay: ControlledTraceReplayReport;
};

export type ControlledTraceFixtureCatalogReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  items: ControlledTraceFixtureCatalogReportItem[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};
```

Function:

```ts
export function buildControlledTraceFixtureCatalogReport(
  entries: ControlledTraceFixtureCatalogEntry[] = controlledTraceFixtureCatalog,
): ControlledTraceFixtureCatalogReport
```

Behavior:

- For each entry:
  - run `validateControlledTraceFixture(entry.fixture)`;
  - run `replayControlledTraceFixture(entry.fixture)`;
  - mark the item `ok` only when validation and replay both pass.
- Aggregate:
  - `total` is `entries.length`;
  - `passed` is count of ok items;
  - `failed` is count of non-ok items;
  - `fixtureIds` uses catalog entry ids;
  - `playbookIds` uses entry playbook ids;
  - top-level `ok` is true only when every item is ok.
- Top-level guarantees remain false for tools and asset writes.

## Testing

Modify:

`src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`

Add coverage:

- all committed catalog entries produce:
  - `ok: true`,
  - `total: 2`,
  - `passed: 2`,
  - `failed: 0`,
  - fixture ids `["sales-pipeline-governed", "support-resolution-governed"]`,
  - playbook ids `["sales-pipeline-v1", "support-resolution-v1"]`,
  - no-side-effect guarantees.
- a synthetic drifting catalog entry returns:
  - `ok: false`,
  - `passed: 0`,
  - `failed: 1`,
  - item replay errors,
  - item replay diagnostics containing expected step order and fixture step order.

## Acceptance Criteria

- Catalog report exposes all committed fixture replay health in one object.
- Synthetic drift keeps structured diagnostics visible at the aggregate report item level.
- Existing catalog replay tests remain green.
- `test:controlled-runtime`, `test:core-workflows`, lint, build, and `git diff --check` pass.
