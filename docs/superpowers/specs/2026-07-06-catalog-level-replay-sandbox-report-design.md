# Catalog-Level Replay Sandbox Report Design

Last updated: 2026-07-06

## Context

The controlled runtime now has:

- committed governed trace fixtures for sales and support playbooks;
- an explicit fixture catalog;
- pure trace fixture validation and metadata replay reports;
- replay sandbox contract types;
- a no-side-effect replay sandbox prototype;
- a bridge from governed fixture metadata to `ReplaySandboxContract`.

The next gap is an aggregate report that proves every committed governed
fixture can enter the replay sandbox path:

```text
fixture catalog -> fixture contract bridge -> no-side-effect replay sandbox artifact
```

This phase must stay as a pure composition layer. It should not introduce real
replay, route integration, store access, fixture discovery, or UI behavior.

## Goal

Add a TypeScript-only catalog report helper that runs each explicit governed
fixture catalog entry through:

1. `buildReplaySandboxContractFromFixture()`;
2. `runNoSideEffectReplaySandbox()`;
3. aggregate report construction.

The report should give maintainers a single object that answers:

- how many fixtures were checked;
- which playbooks and fixture ids were covered;
- which entries passed or failed contract build / sandbox preflight;
- what sandbox result artifact was emitted for each safe contract;
- what no-side-effect guarantees were preserved.

## Non-Goals

This phase does not implement:

- LLM replay;
- tool replay;
- API route replay;
- route handlers;
- package scripts;
- Runtime Console UI;
- automatic filesystem fixture discovery;
- fixture JSON mutation or refresh;
- runtime store reads/writes;
- business asset writes;
- raw governed artifact payload recovery.

## Chosen Approach

Create:

```text
src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts
```

Export:

```ts
buildReplaySandboxCatalogReport(
  entries?: ControlledTraceFixtureCatalogEntry[],
): ReplaySandboxCatalogReport
```

This follows the existing test-fixture catalog report pattern in
`src/__tests__/fixtures/controlled-traces/catalog-report.ts`. The helper lives
beside the committed test fixture catalog because it depends on test fixture
imports and should not become production runtime surface.

## Report Shape

The report should include:

- `ok`: true when every item passes;
- `total`, `passed`, `failed`;
- `fixtureIds`: catalog entry ids;
- `playbookIds`: catalog playbook ids;
- `items`: per-entry report rows;
- `guarantees`: aggregate no-side-effect guarantees.

Each item should include:

- `catalogId`;
- `fixtureId`;
- `playbookId`;
- `ok`;
- `contractBuild`: the structured result from
  `buildReplaySandboxContractFromFixture()`;
- `artifact`: the sandbox result artifact when contract build succeeds;
- `errors`: a stable flattened list of contract build errors and failed
  sandbox diagnostics.

For failed contract builds, `artifact` should be `null`.

For successful contract builds, the helper must call
`runNoSideEffectReplaySandbox()` and preserve the returned
`ReplayResultArtifact`.

## Pass / Fail Semantics

An item passes only when:

- contract build returns `ok: true`;
- sandbox artifact status is `succeeded`;
- sandbox guarantees remain:
  - `toolCallsExecuted: false`;
  - `assetsWritten: false`;
  - `runtimeStoresMutated: false`;
  - `productionCredentialsUsed: false`.

An item fails when:

- contract build returns `ok: false`; or
- sandbox artifact status is `failed`; or
- any sandbox guarantee is not false.

The aggregate report passes only when every item passes.

## Safety Boundaries

The helper must remain pure:

- no file reads/writes;
- no route calls;
- no server store imports;
- no production runtime store reads/writes;
- no tool execution;
- no LLM calls;
- no business asset writes;
- no Runtime Console events;
- no automatic fixture discovery.

It may import:

- explicit fixture catalog types/data from `src/__tests__/fixtures`;
- `buildReplaySandboxContractFromFixture()`;
- `runNoSideEffectReplaySandbox()`;
- replay sandbox contract/result types.

## Tests

Add:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
```

Required coverage:

- builds an all-green report for the current committed sales/support governed
  fixtures;
- preserves per-item sandbox artifacts and simulated approval metadata;
- returns a failed report when a fixture cannot be converted into a sandbox
  contract;
- keeps the aggregate no-side-effect guarantees explicit.

Add the new test to `npm run test:controlled-runtime`.

## Verification

Final verification for this phase:

```bash
git diff --check
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts src/__tests__/lib/executor/runtime/replay-sandbox.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

## Next Phase

After this report exists, the next reasonable phase is a local CLI summary for
the replay sandbox catalog report. That future command should print compact JSON
and fail non-zero on report failure, but it should still avoid route calls,
store access, real replay, and side effects.
