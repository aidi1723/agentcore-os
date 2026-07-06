# Trace Fixture Catalog CI Summary Design

## Context

Phase 10g added `buildControlledTraceFixtureCatalogReport()` for explicit governed fixture catalog health. The report is available to tests, but maintainers still need to inspect Vitest output to understand fixture drift. A focused local command can expose the same report as compact JSON and return a non-zero exit code when fixtures drift.

This phase keeps the boundary local and pure. It consumes the explicit committed catalog report helper and does not add runtime API surface, UI, filesystem discovery, real tool replay, store reads/writes, or asset writeback.

## Goals

- Add a local script that prints a compact JSON summary of the governed trace fixture catalog report.
- Add an npm script for maintainers and CI.
- Exit `0` when all committed fixtures validate and replay.
- Exit non-zero when any catalog fixture fails validation or replay.
- Include failure diagnostics in stdout JSON so CI logs can show stale fixture ids and replay diagnostics.
- Test the command through a Node subprocess.

## Non-Goals

- No API route.
- No Runtime Console or UI changes.
- No automatic filesystem discovery.
- No fixture generation.
- No fixture mutation.
- No LLM replay.
- No tool execution.
- No runtime store reads or writes.
- No asset writeback.

## Proposed Design

Create:

`scripts/trace-fixtures/catalog-report.mjs`

The script will import the Phase 10g helper through the existing TypeScript alias loader:

```bash
node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/catalog-report.mjs
```

The script prints JSON to stdout:

```ts
type TraceFixtureCatalogSummaryOutput = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  failedItems: Array<{
    catalogId: string;
    fixtureId: string;
    playbookId: string;
    validationErrors: string[];
    replayErrors: string[];
    diagnostics: ControlledTraceReplayDiagnostics;
  }>;
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};
```

Behavior:

- Call `buildControlledTraceFixtureCatalogReport()`.
- Build a compact output object from the full report.
- Print `JSON.stringify(output, null, 2)` to stdout.
- Set `process.exitCode = 1` when `report.ok` is false.
- Do not print additional prose; CI should be able to parse stdout as JSON.

Modify:

`package.json`

Add:

```json
"trace:fixtures": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/catalog-report.mjs"
```

## Testing

Create:

`src/__tests__/scripts/trace-fixture-catalog-report-script.test.ts`

Test behavior:

- Spawn `npm run trace:fixtures --silent`.
- Assert exit status is `0`.
- Parse stdout as JSON.
- Assert:
  - `ok: true`;
  - `total: 2`;
  - `passed: 2`;
  - `failed: 0`;
  - fixture ids include sales and support catalog ids;
  - failed items is empty;
  - guarantees are false for tool calls and asset writes.

No failure-mode subprocess test is required in this phase because the command consumes the committed catalog. Drift failure behavior remains covered by Phase 10g synthetic report tests.

## Acceptance Criteria

- `npm run trace:fixtures --silent` prints parseable compact JSON.
- Command exits `0` for the current committed sales/support fixtures.
- Output includes aggregate counts, fixture ids, playbook ids, failed items, diagnostics, and no-side-effect guarantees.
- Existing controlled runtime, core workflow, lint, build, and diff checks pass.
