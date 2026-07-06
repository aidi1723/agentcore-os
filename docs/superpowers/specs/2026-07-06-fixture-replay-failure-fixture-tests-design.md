# Fixture Replay Failure Fixture Tests Design

## Context

Phase 10m added a human-readable governed fixture replay summary command. The summary formatter already has one synthetic failure test, but that failure case is built inline by cloning a committed governed fixture and mutating it inside the test.

That works for one case, but it does not scale. As replay/report/summary coverage grows, inline fixture mutations will make tests noisy, duplicate drift setup, and make it easier to accidentally alter committed green fixtures.

## Goal

Add reusable synthetic failure fixtures for governed trace replay tests so report and summary tests can exercise drift diagnostics without making committed governed fixtures fail.

## Non-Goals

- Do not add new committed failing governed fixture JSON files to the catalog.
- Do not change `npm run trace:fixtures` output for the current catalog.
- Do not change `npm run trace:fixtures:summary` output for the current green catalog.
- Do not discover fixture files automatically.
- Do not refresh or rewrite governed fixtures.
- Do not call API routes.
- Do not replay tools, LLM calls, or browser actions.
- Do not read or write runtime stores.
- Do not write assets.

## Fixture Boundary

Create a test-only helper:

```text
src/__tests__/fixtures/controlled-traces/synthetic-failures.ts
```

It should export explicit factory functions, not an automatically discovered catalog. Each factory should return a fresh `ControlledTraceFixtureCatalogEntry` so tests can mutate returned fixtures without affecting other tests.

Initial factories:

- `buildPlaybookVersionDriftCatalogEntry()`
  - based on the sales governed fixture;
  - changes `fixture.playbookVersion` to `0.9.0`;
  - catalog id: `sales-pipeline-version-drift`.
- `buildMissingStableMetadataCatalogEntry()`
  - based on the sales governed fixture;
  - removes `sourceKey` from the successful `sales_asset` writeback target;
  - catalog id: `sales-pipeline-missing-stable-metadata`.
- `buildCombinedSummaryFailureCatalogEntry()`
  - based on the sales governed fixture;
  - combines playbook version drift and missing stable metadata;
  - catalog id: `sales-pipeline-summary-drift`;
  - intended for summary formatting tests that need multiple high-signal diagnostics in one failed item.

The helper should use `structuredClone()` from the committed fixture catalog. It should not import runtime stores, routes, or script entrypoints.

## Report Test Coverage

Extend catalog report coverage to prove synthetic failure entries:

- produce failed aggregate reports;
- preserve explicit catalog ids;
- preserve playbook ids;
- expose replay errors and diagnostics;
- keep no-side-effect guarantees:
  - `toolCallsExecuted: false`;
  - `assetsWritten: false`.

## Summary Test Coverage

Refactor the summary formatter failure test to consume `buildCombinedSummaryFailureCatalogEntry()` instead of mutating the fixture inline.

The assertions should keep covering:

- `Status: FAILED`;
- failed fixture id;
- playbook version drift message;
- missing stable metadata message;
- expected/fixture playbook versions;
- `writebackTargetsMissingStableMetadata` line.

## Safety Requirements

- The committed governed catalog must remain all green.
- Synthetic failure helpers must live under `src/__tests__/fixtures`, not production runtime code.
- Report and summary tests must pass without filesystem writes.
- The existing scripts must remain:
  - `npm run trace:fixtures` as stable JSON;
  - `npm run trace:fixtures:summary` as local human-readable text.

## Documentation Updates

Update:

- `docs/NEXT_STEPS.md`: mark Phase 10n completed and select the next conservative phase.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: record Phase 10n.
- `CHANGELOG.md`: add an Unreleased entry.
- `memory/2026-07-06.md`: record local phase completion.

## Next Recommended Phase

After 10n, the next conservative phase should be:

**Phase 10o. Fixture Replay Failure Exit-Code Harness**

Suggested scope:

- Add a focused test harness for non-zero summary/report process behavior using synthetic failed catalog inputs without changing committed fixture scripts.
- Keep committed fixture commands green.
- Avoid route calls, tool replay, store mutation, asset writes, and fixture refresh.

## Success Criteria

- Reusable synthetic failure factories exist under the test fixture boundary.
- Summary failure tests consume reusable fixtures instead of inline mutation.
- Catalog report tests cover at least two reusable failure entries.
- `npm run trace:fixtures` remains green JSON for committed fixtures.
- `npm run trace:fixtures:summary` remains green human-readable output for committed fixtures.
- `test:controlled-runtime` passes.
- Full verification passes with only the existing lint/build warning if it appears.
