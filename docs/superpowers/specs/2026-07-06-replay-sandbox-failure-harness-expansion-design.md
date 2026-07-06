# Replay Sandbox Failure Harness Expansion Design

## Status

Draft for Phase 10ad.

## Context

Phase 10ac added replay sandbox failure diagnostics taxonomy:

- `contract_build_failed`
- `sandbox_artifact_failed`
- `guarantee_violation`

The current test-only harness at `scripts/trace-fixtures/replay-sandbox-failure-harness.mjs` still synthesizes only one broken-contract failure. This proves non-zero process behavior for a failed replay sandbox report, but it does not prove that the process-level harness can exercise all failure taxonomy branches.

## Goal

Add direct test-only replay sandbox failure harness modes for contract, sandbox, and guarantee failures while keeping committed fixture commands green.

## Non-Goals

- Do not add failing committed fixture JSON.
- Do not add a public npm script for synthetic failures.
- Do not run real replay.
- Do not execute LLMs or tools.
- Do not call API routes.
- Do not read or write runtime stores.
- Do not mutate fixture JSON.
- Do not write business assets.
- Do not connect the harness to Runtime Console.

## Proposed Behavior

`scripts/trace-fixtures/replay-sandbox-failure-harness.mjs` accepts an optional mode argument:

```bash
node --import ./scripts/register-ts-alias-loader.mjs \
  ./scripts/trace-fixtures/replay-sandbox-failure-harness.mjs contract
node --import ./scripts/register-ts-alias-loader.mjs \
  ./scripts/trace-fixtures/replay-sandbox-failure-harness.mjs sandbox
node --import ./scripts/register-ts-alias-loader.mjs \
  ./scripts/trace-fixtures/replay-sandbox-failure-harness.mjs guarantee
```

The default mode remains `contract` for backward compatibility with existing tests.

Each mode prints compact JSON from `buildReplaySandboxCatalogReportOutput()` and exits `1` because the report is intentionally failed.

Mode behavior:

- `contract`: clone the first committed fixture and break source/run/redaction metadata so `buildReplaySandboxContractFromFixture()` fails. Expected `failureKind`: `contract_build_failed`.
- `sandbox`: use the first committed fixture unchanged, inject a pure sandbox runner that returns a failed replay result artifact. Expected `failureKind`: `sandbox_artifact_failed`.
- `guarantee`: use the first committed fixture unchanged, inject a pure sandbox runner that returns a succeeded artifact with one no-side-effect guarantee flipped. Expected `failureKind`: `guarantee_violation`.

Unknown modes should fail closed with stderr and exit `2` without printing misleading report JSON.

## Architecture

Keep all synthetic failure construction inside the test-only harness script. Reuse:

- `controlledTraceFixtureCatalog`
- `buildReplaySandboxCatalogReport()`
- `buildReplaySandboxCatalogReportOutput()`
- `buildNoSideEffectReplayResultArtifact()`

No production runtime module changes are required. The only TypeScript-side change should be subprocess test coverage, plus optional inclusion in `test:controlled-runtime` if the existing test file remains in that gate.

## Output Contract

For supported failure modes, stdout is parseable JSON with:

- `ok: false`
- `total: 1`
- `passed: 0`
- `failed: 1`
- `failedItems[0].failureKind`
- `failedItems[0].guaranteeErrors`
- no stderr
- process status `1`

For unsupported modes:

- stdout is empty
- stderr explains the supported modes
- process status `2`

## Tests

Extend `src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts`:

- keep committed `npm run replay:sandbox:fixtures --silent` green;
- assert default/contract mode still exits `1` with `contract_build_failed`;
- assert `sandbox` mode exits `1` with `sandbox_artifact_failed`;
- assert `guarantee` mode exits `1` with `guarantee_violation` and non-empty `guaranteeErrors`;
- assert unknown mode exits `2` with stderr and no stdout.

Targeted command:

```bash
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Gate command:

```bash
npm run test:controlled-runtime
```

## Documentation

After implementation, update:

- `CHANGELOG.md`
- `README.md`
- `docs/NEXT_STEPS.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_FRAMEWORK.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- this phase plan
- `memory/2026-07-06.md`

## Acceptance Criteria

- The harness supports `contract`, `sandbox`, and `guarantee` modes.
- Existing no-argument behavior remains contract failure.
- Each supported mode exits `1` with parseable compact JSON.
- Unknown modes exit `2` without report JSON.
- `npm run replay:sandbox:fixtures --silent` remains green for committed fixtures.
- `npm run test:controlled-runtime` passes.
