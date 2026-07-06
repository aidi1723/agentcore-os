# Fixture Replay Error Summary CLI Design

## Context

Phase 10h added `npm run trace:fixtures`, a machine-readable JSON command for governed fixture catalog health. Phase 10k deepened replay diagnostics. Phase 10l documented the replay contract so maintainers can interpret failures.

The remaining maintenance gap is ergonomics: when fixture replay fails, a maintainer currently has to read nested JSON and manually map `failedItems[].diagnostics` to the contract guide. CI should keep the existing JSON command stable, but local maintainers need a concise human-readable summary.

## Goal

Add a local human-readable fixture replay summary command that prints fixture catalog health and grouped failure details from the same catalog report used by `trace:fixtures`.

## Non-Goals

- Do not change `npm run trace:fixtures` output shape or exit behavior.
- Do not discover fixture files automatically.
- Do not refresh or rewrite committed fixtures.
- Do not call API routes.
- Do not replay LLM calls or tools.
- Do not read or write runtime stores.
- Do not write assets.
- Do not add UI or browser behavior.

## Proposed Command

Add:

```bash
npm run trace:fixtures:summary
```

It should:

- print a human-readable text report to stdout;
- exit `0` when all committed fixtures pass;
- exit non-zero when one or more fixtures fail;
- write no files;
- use the explicit catalog and existing `buildControlledTraceFixtureCatalogReport()` helper.

## Output Contract

For all-green committed fixtures, output should be compact and stable:

```text
Governed trace fixture replay summary
Status: OK
Fixtures: 2 total, 2 passed, 0 failed
Catalog: sales-pipeline-governed, support-resolution-governed
Playbooks: sales-pipeline-v1, support-resolution-v1
Guarantees: toolCallsExecuted=false, assetsWritten=false
```

For failing fixtures, output should include:

- status line;
- aggregate counts;
- per failed item:
  - catalog id;
  - fixture id;
  - playbook id;
  - validation errors;
  - replay errors;
  - high-signal diagnostics:
    - expected and fixture step order;
    - missing approval step ids;
    - missing writeback targets;
    - expected and fixture plan/version/scenario metadata;
    - missing completed attempts;
    - non-approved approval step ids;
    - writeback targets missing stable metadata.

The text format can be line-oriented. It does not need colors, tables, terminal width detection, or interactive prompts.

## Implementation Shape

Create:

- `scripts/trace-fixtures/catalog-summary.mjs`

Add package script:

- `"trace:fixtures:summary": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/catalog-summary.mjs"`

Add test:

- `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`

The test should verify:

1. The new command prints the expected all-green summary for committed fixtures.
2. The summary command exits `0` on green catalog.
3. The existing JSON command still prints parseable JSON and is not replaced.

The failure formatter should be testable without requiring committed fixtures to fail. Add a small exported formatter helper under the test fixture boundary:

- either export `formatControlledTraceFixtureCatalogSummary(report)` from `src/__tests__/fixtures/controlled-traces/catalog-report.ts`;
- or create `src/__tests__/fixtures/controlled-traces/catalog-summary.ts`.

Prefer the second option to keep report construction and summary formatting separate.

Add unit coverage for a synthetic failed report so the formatter renders failure details without mutating committed fixtures.

## Error And Exit Policy

- If report `ok` is `true`, print summary and exit `0`.
- If report `ok` is `false`, print summary and set `process.exitCode = 1`.
- The command should not print stack traces for ordinary fixture drift, because drift is a report state, not a script crash.
- Unexpected script crashes can use Node's normal failure behavior.

## Documentation Updates

Update:

- `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`: mention the human-readable summary command as the first local triage step once it exists.
- `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`: add the summary command before manual fixture refresh.
- `docs/NEXT_STEPS.md`: mark Phase 10m completed and choose the next conservative phase.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: record Phase 10m.
- `CHANGELOG.md`: add an Unreleased entry.
- `memory/2026-07-06.md`: record local phase completion.

## Next Recommended Phase

After 10m, the next conservative phase should be:

**Phase 10n. Fixture Replay Failure Fixture Tests**

Suggested scope:

- Add reusable synthetic failure fixtures for summary/report tests.
- Keep committed governed fixtures green.
- Avoid automatic fixture discovery, refresh, route calls, tool replay, store mutation, and asset writes.

## Success Criteria

- `npm run trace:fixtures` remains machine-readable JSON.
- `npm run trace:fixtures:summary` prints a human-readable summary.
- The summary command exits `0` for current committed fixtures.
- Synthetic failure coverage proves failure diagnostics render without making committed fixtures fail.
- `test:controlled-runtime` includes summary command coverage.
- Full verification passes with only the existing lint/build warning if it appears.
