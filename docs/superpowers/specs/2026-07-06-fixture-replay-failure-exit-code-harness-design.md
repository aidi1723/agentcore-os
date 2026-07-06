# Fixture Replay Failure Exit-Code Harness Design

## Context

Phase 10h added `npm run trace:fixtures` as the machine-readable governed fixture catalog health command. Phase 10m added `npm run trace:fixtures:summary` as the human-readable local summary command. Both commands intentionally read the committed governed fixture catalog, which should remain green.

Phase 10n added reusable synthetic failed catalog entries for report and summary tests. The remaining coverage gap is process-level behavior for failed reports: the CLI wrappers set `process.exitCode = 1` when a report fails, but the committed commands cannot be made to fail for tests without breaking catalog health.

## Goal

Add a focused test harness that can execute report and summary output paths with synthetic failed catalog inputs and verify non-zero exit behavior without changing committed fixture commands.

## Non-Goals

- Do not make committed governed fixtures fail.
- Do not change `npm run trace:fixtures` output shape or green exit behavior.
- Do not change `npm run trace:fixtures:summary` output shape or green exit behavior.
- Do not add a public npm script for synthetic failures.
- Do not discover fixture files automatically.
- Do not refresh or rewrite governed fixtures.
- Do not call API routes.
- Do not replay tools, LLM calls, or browser actions.
- Do not read or write runtime stores.
- Do not write assets.

## Harness Shape

Create a small local harness script:

```text
scripts/trace-fixtures/catalog-failure-harness.mjs
```

The script should be invoked directly by tests with the existing TypeScript alias loader:

```bash
node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/catalog-failure-harness.mjs --format json
node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/catalog-failure-harness.mjs --format summary
```

It should:

- build a report from `buildCombinedSummaryFailureCatalogEntry()`;
- print JSON when `--format json` is passed;
- print human-readable text when `--format summary` is passed;
- set `process.exitCode = 1` because the injected synthetic catalog fails;
- print a stable stderr usage message and exit non-zero for unknown formats.

The harness is not a product command. It exists to test failed process behavior while the committed catalog remains green.

## Output Reuse

To avoid duplicating report JSON shape, extract the JSON output builder from `scripts/trace-fixtures/catalog-report.mjs` into a test fixture helper:

```text
src/__tests__/fixtures/controlled-traces/catalog-report-output.ts
```

It should export:

```ts
buildControlledTraceFixtureCatalogReportOutput(report)
```

`catalog-report.mjs` and `catalog-failure-harness.mjs` should use the same helper so the harness verifies the same JSON contract as the committed command.

`catalog-summary.mjs` can keep using `formatControlledTraceFixtureCatalogSummary(report)` directly.

## Test Coverage

Add:

```text
src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts
```

Tests should verify:

1. JSON harness exits non-zero for synthetic failed catalog input.
2. JSON output is parseable and includes:
   - `ok: false`;
   - `total: 1`;
   - `failed: 1`;
   - failed catalog id `sales-pipeline-summary-drift`;
   - replay errors for playbook version drift and missing stable metadata;
   - no-side-effect guarantees.
3. Summary harness exits non-zero for synthetic failed catalog input.
4. Summary output includes:
   - `Status: FAILED`;
   - `Failed fixture: sales-pipeline-summary-drift`;
   - playbook version drift message;
   - missing stable metadata message.
5. Unknown format exits non-zero with stable stderr usage text.
6. The existing committed commands still exit `0` and remain green.

Include this test file in `npm run test:controlled-runtime`.

## Safety Requirements

- Synthetic failed inputs must come from `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`.
- The harness must not write files.
- The harness must not import runtime stores, routes, browser tooling, or app UI.
- The committed fixture scripts must continue to use the committed catalog by default.

## Documentation Updates

Update:

- `docs/NEXT_STEPS.md`: mark Phase 10o completed and select the next conservative phase.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: record Phase 10o.
- `CHANGELOG.md`: add an Unreleased entry.
- `memory/2026-07-06.md`: record local phase completion.

## Next Recommended Phase

After 10o, the next conservative phase should be:

**Phase 10p. Fixture Replay Validation Failure Fixtures**

Suggested scope:

- Add reusable synthetic validation failure fixtures, not only replay drift fixtures.
- Cover malformed governed fixture schema cases in report/summary diagnostics.
- Keep committed governed fixtures and committed CLI commands green.
- Avoid route calls, tool replay, store mutation, asset writes, fixture refresh, and automatic fixture discovery.

## Success Criteria

- Failed synthetic JSON harness exits non-zero and prints parseable failed report JSON.
- Failed synthetic summary harness exits non-zero and prints failed human-readable diagnostics.
- Unknown harness format exits non-zero with stable stderr.
- Existing committed `trace:fixtures` and `trace:fixtures:summary` commands remain green.
- `test:controlled-runtime` includes the harness tests.
- Full verification passes with only the existing lint/build warning if it appears.
