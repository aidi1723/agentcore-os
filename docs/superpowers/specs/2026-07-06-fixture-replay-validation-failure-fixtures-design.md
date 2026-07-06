# Fixture Replay Validation Failure Fixtures Design

## Context

Phase 10n added reusable synthetic replay failure fixtures. Those fixtures start from a valid governed fixture and introduce drift against the current playbook, such as playbook version mismatch or missing stable writeback metadata.

Phase 10o added a direct-invoked failure harness so failed report and summary subprocess behavior can be tested without making committed fixture commands fail.

The remaining diagnostics gap is fixture validation failure coverage. `validateControlledTraceFixture()` can reject malformed or unsafe fixtures before replay details matter, but current reusable synthetic fixtures mostly exercise replay drift. Maintainers need report and summary tests that prove validation errors are preserved and readable.

## Goal

Add reusable synthetic validation failure fixtures for governed trace report and summary tests while keeping committed governed fixtures and committed CLI commands green.

## Non-Goals

- Do not add failing governed fixture JSON files to the committed catalog.
- Do not change `npm run trace:fixtures` output shape or green exit behavior.
- Do not change `npm run trace:fixtures:summary` output shape or green exit behavior.
- Do not discover fixture files automatically.
- Do not refresh or rewrite governed fixtures.
- Do not call API routes.
- Do not replay tools, LLM calls, or browser actions.
- Do not read or write runtime stores.
- Do not write assets.

## Fixture Boundary

Extend:

```text
src/__tests__/fixtures/controlled-traces/synthetic-failures.ts
```

Add explicit factory functions:

- `buildMissingSourceRunIdCatalogEntry()`
  - based on the sales governed fixture;
  - clears `fixture.sourceRunId`;
  - catalog id: `sales-pipeline-missing-source-run-id`;
  - expected validation error: `Fixture sourceRunId is required`.
- `buildUnredactedInputCatalogEntry()`
  - based on the sales governed fixture;
  - sets the `intake` step `hasRedactedInput` to `false`;
  - catalog id: `sales-pipeline-unredacted-input`;
  - expected validation error: `Step intake input is not redacted`.
- `buildUnredactedToolOutputCatalogEntry()`
  - based on the sales governed fixture;
  - sets the `intake` step first tool call `outputRedacted` to `false`;
  - catalog id: `sales-pipeline-unredacted-tool-output`;
  - expected validation error: `Step intake tool llm_generate output is not redacted`.
- `buildCombinedValidationFailureCatalogEntry()`
  - based on the sales governed fixture;
  - combines missing `sourceRunId`, unredacted `intake` input, and unredacted `intake` tool output;
  - catalog id: `sales-pipeline-validation-failure`;
  - intended for summary diagnostics tests.

Each factory must return a fresh `ControlledTraceFixtureCatalogEntry`.

## Report Coverage

Extend catalog report tests to prove synthetic validation failures:

- produce a failed aggregate report;
- preserve explicit catalog ids;
- preserve no-side-effect guarantees;
- include validation errors in report items;
- can coexist with replay diagnostics without mutating committed fixtures.

## Summary Coverage

Extend summary tests to verify validation failures render in human-readable text.

The summary should include:

- `Status: FAILED`;
- `Failed fixture: sales-pipeline-validation-failure`;
- `validationErrors: Fixture sourceRunId is required, Step intake input is not redacted, Step intake tool llm_generate output is not redacted`.

No summary format change is required if the current formatter already prints `validationErrors`.

## Safety Requirements

- Synthetic validation failures must stay under `src/__tests__/fixtures`.
- The committed explicit fixture catalog must remain all green.
- The new factories must not be imported by committed fixture scripts.
- Tests must not write files.
- Tests must not call routes, stores, tools, LLMs, browser actions, or asset writers.

## Documentation Updates

Update:

- `docs/NEXT_STEPS.md`: mark Phase 10p completed and select the next conservative phase.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: record Phase 10p.
- `CHANGELOG.md`: add an Unreleased entry.
- `memory/2026-07-06.md`: record local phase completion.

## Next Recommended Phase

After 10p, the next conservative phase should be:

**Phase 10q. Fixture Replay Failure Documentation Matrix**

Suggested scope:

- Update the replay contract guide with a concise failure fixture matrix.
- Document which synthetic factories cover validation failures, replay drift failures, and process exit behavior.
- Keep implementation unchanged unless documentation exposes a real coverage gap.

## Success Criteria

- Reusable synthetic validation failure factories exist under the test fixture boundary.
- Catalog report tests cover multiple reusable validation failure entries.
- Summary tests render combined validation failure diagnostics.
- Existing committed `trace:fixtures` and `trace:fixtures:summary` commands remain green.
- `test:controlled-runtime` passes.
- Full verification passes with only the existing lint/build warning if it appears.
