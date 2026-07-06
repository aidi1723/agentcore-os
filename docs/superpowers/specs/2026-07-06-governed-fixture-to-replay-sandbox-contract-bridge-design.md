# Governed Fixture To Replay Sandbox Contract Bridge Design

Last updated: 2026-07-06

## Context

The current controlled runtime line has completed:

- governed trace artifacts;
- committed governed trace fixtures;
- pure metadata fixture replay;
- replay sandbox contract types;
- no-side-effect replay sandbox prototype.

The next gap is a pure bridge from committed governed fixture metadata to
`ReplaySandboxContract`. This must not recover raw governed artifact payloads,
modify fixture JSON, read runtime stores, call routes, execute tools, or write
business assets.

## Goal

Add a TypeScript-only helper that converts a committed
`ControlledTraceFixture` into a safe `ReplaySandboxContract` for
`runNoSideEffectReplaySandbox()`.

The bridge should allow current sales/support governed fixtures to enter the
no-side-effect sandbox prototype as contracts, while preserving all replay
boundaries.

## Non-Goals

This phase does not implement:

- LLM replay;
- tool replay;
- API route replay;
- runtime store reads/writes;
- business asset writes;
- fixture JSON refresh;
- raw governed artifact payload recovery;
- Runtime Console integration.

## Chosen Approach

Create:

```text
src/lib/executor/runtime/replay-sandbox-fixture-contract.ts
```

Export:

```ts
buildReplaySandboxContractFromFixture(
  fixture: ControlledTraceFixture,
  options?: {
    replayId?: string;
    sandboxId?: string;
  },
): ReplaySandboxContractBuildResult
```

The helper returns a result object instead of throwing ordinary validation
errors:

- `ok: true` with `contract` for safe fixtures;
- `ok: false` with `errors` for unsafe or incomplete fixture metadata.

This matches the controlled runtime preference for structured failures over
half-executed state or ambiguous exceptions.

## Contract Mapping

For a safe fixture, the generated contract should use:

- `replayId`: option value or `replay:${fixture.fixtureId}`;
- `sandboxId`: option value or `sandbox:${fixture.fixtureId}`;
- `mode`: `no_side_effect_prototype`;
- `input.kind`: `committed_fixture`;
- `input.sourceId`: `fixture.fixtureId`;
- `input.playbookId`: `fixture.playbookId`;
- `input.playbookVersion`: `fixture.playbookVersion`;
- `input.scenarioId`: `fixture.scenarioId`;
- `input.generatedAt`: `fixture.generatedAt`;
- `input.governanceMode`: `fixture.governance.mode`;
- `input.redactionBoundary`: `fixture.assertions.redactionBoundary`;
- `credentialPolicy.mode`: `fixture`;
- `approvalPolicy.mode`: `fixture_derived`;
- `approvalPolicy.simulatedDecisions`: derived only from fixture approval
  metadata:
  - `approved` -> `approved`
  - `rejected` -> `rejected`
- `storePolicy.mode`: `fixture_only`;
- `storePolicy.requestedStores`: `[]`;
- `sideEffectPolicy.allowedOutput`: `replay_result_artifact`;
- `sideEffectPolicy.blocked`: `[]`.

The helper must call `validateReplaySandboxContract()` before returning a
successful contract.

## Rejection Rules

Reject fixture-to-contract conversion when:

- fixture validation fails;
- `fixtureId` is missing;
- `sourceRunId` is missing;
- `playbookId` is missing;
- `playbookVersion` is missing;
- `scenarioId` is missing;
- `generatedAt` is not a number;
- `governance.mode` is not `fixture` or `audit`;
- `assertions.redactionBoundary` is not `required`;
- derived contract validation fails.

The rejection result must preserve validation diagnostics so maintainers can
fix the fixture or bridge mapping without reading implementation internals.

## Safety Boundaries

The bridge must be pure:

- no imports from server stores;
- no route calls;
- no file reads/writes;
- no fixture catalog mutation;
- no tool execution;
- no LLM calls;
- no business asset writes;
- no Runtime Console events.

The bridge can be used by tests with the committed fixture catalog, but the
production helper itself must not import test fixtures.

## Tests

Add:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-fixture-contract.test.ts
```

Required coverage:

- converts a safe sales fixture into a valid replay sandbox contract;
- converts current committed sales/support fixtures into contracts accepted by
  the no-side-effect sandbox prototype;
- rejects fixtures with broken provenance/redaction boundaries;
- preserves no-side-effect guarantees through sandbox prototype execution.

Add the new test to `npm run test:controlled-runtime`.

## Verification

Final verification for this phase:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

## Next Phase

After this bridge is complete, the next phase can design a catalog-level replay
sandbox report that runs committed fixtures through:

```text
fixture -> replay sandbox contract -> no-side-effect replay result artifact
```

That future phase must remain no-side-effect and must not introduce real tool
replay.
