# Fixture Replay Failure Documentation Matrix Design

## Problem

Governed trace fixture replay now has committed green fixtures plus reusable
synthetic failures for validation, replay drift, and process exit behavior.
The runtime tests prove these paths, but maintainers still need to jump between
test files to understand which fixture factory represents which failure class.

The replay contract guide should become the first triage surface for fixture
failures. It needs a concise matrix that maps each known failure category to:

- the diagnostic emitted to the maintainer;
- the reusable synthetic failure factory or harness that proves it;
- the test file that owns the regression;
- the expected maintainer action.

## Goals

- Document validation failure fixtures introduced for unsafe fixture sources:
  missing `sourceRunId`, unredacted step input, and unredacted tool output.
- Document replay drift fixtures that prove stale playbook metadata and missing
  stable writeback metadata are reported with diagnostics.
- Document the failure harness that proves local summary and JSON commands
  remain green for committed fixtures while synthetic failed catalogs exit
  non-zero.
- Keep this phase docs-only unless the matrix review exposes a real coverage
  gap.
- Align the changelog, next steps, and controlled runtime development manual so
  the new maintenance path is visible from the main project documents.

## Non-Goals

- Do not add new governed fixture JSON files.
- Do not change runtime replay, validation, or summary behavior.
- Do not refresh committed fixtures.
- Do not broaden replay beyond metadata checks.
- Do not add LLM/tool execution, store reads, asset writes, or API calls to
  fixture replay.

## Source Inventory

- Replay contract guide:
  `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- Refresh guide:
  `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Synthetic failure factories:
  `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts`
- Catalog report coverage:
  `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
- Summary rendering coverage:
  `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts`
- Failure exit harness coverage:
  `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts`
- Failure harness script:
  `scripts/trace-fixtures/catalog-failure-harness.mjs`

## Documentation Contract

Add a new section to the replay contract guide named `Failure Fixture Matrix`.
The section must include a table with these columns:

- Failure class
- Synthetic source
- Proven diagnostics
- Regression owner
- Maintainer action

The matrix must cover at least:

- `buildMissingSourceRunIdCatalogEntry()`
- `buildUnredactedInputCatalogEntry()`
- `buildUnredactedToolOutputCatalogEntry()`
- `buildCombinedValidationFailureCatalogEntry()`
- `buildPlaybookVersionDriftCatalogEntry()`
- `buildMissingStableMetadataCatalogEntry()`
- `buildCombinedSummaryFailureCatalogEntry()`
- `catalog-failure-harness.mjs --format json|summary`

## Acceptance Criteria

- Maintainers can identify the source factory/test for every documented
  validation and replay failure without reading implementation history.
- The matrix explicitly states that synthetic failures are test fixtures, not
  committed governed trace fixtures.
- The replay guide still preserves the no-side-effect replay boundary.
- `docs/NEXT_STEPS.md` points the next phase beyond documentation matrix work.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md` records the new
  fixture replay maintenance practice.
- `CHANGELOG.md` records Phase 10q as a documentation and maintenance-path
  update.
- Verification remains green for fixture replay, controlled runtime, core
  workflows, lint, build, and whitespace checks.

