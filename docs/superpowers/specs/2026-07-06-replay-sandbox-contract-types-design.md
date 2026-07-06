# Replay Sandbox Contract Types Design

## Context

Phase 10v added `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`. It defines the
future real replay boundary, but the codebase still has no TypeScript contract
that encodes those boundaries.

The current replay implementation remains metadata-only:

- `trace-fixtures.ts` builds and validates governed fixtures;
- `trace-replay.ts` compares fixture metadata with current playbook contracts;
- no LLM replay, tool execution, API route calls, store reads/writes, or asset
  writes happen during fixture replay.

The next step is to define replay sandbox contract types and a pure validator
that rejects unsafe sandbox requests before any future prototype work starts.

## Goal

Add TypeScript-only replay sandbox contracts and validation helpers for:

- replay input provenance;
- sandbox context ownership;
- credential policy;
- approval simulation;
- store isolation;
- side-effect policy;
- replay result artifact shape.

The validator must reject live credentials, production store access, and
business asset write targets. It should also expose explicit no-side-effect
guarantees for safe contracts.

## Non-Goals

- Do not implement real replay.
- Do not replay LLM output.
- Do not execute tools or tool simulators.
- Do not call API routes.
- Do not read or write runtime stores.
- Do not write business assets.
- Do not add package scripts.
- Do not add fixture JSON.
- Do not change Runtime Console UI.
- Do not add a replay sandbox prototype.

## Proposed Files

- Create `src/lib/executor/runtime/replay-sandbox-contracts.ts`
  - Types for replay input, sandbox context, credentials, approvals, store
    isolation, side-effect policy, result artifacts, and validation reports.
  - Pure `validateReplaySandboxContract()` helper.
  - Optional `buildNoSideEffectReplayResultArtifact()` helper only if useful
    for testing result artifact shape without executing replay.
- Create `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`
  - TDD coverage for safe contract acceptance and unsafe contract rejection.
- Modify `package.json`
  - Add the new test file to `test:controlled-runtime`.
- Modify project docs after implementation
  - `docs/NEXT_STEPS.md`
  - `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
  - `CHANGELOG.md`

## Contract Model

### Replay Input

Allowed sources:

- `governed_artifact`
- `committed_fixture`
- `sandbox_snapshot`

Required fields:

- `sourceId`
- `playbookId`
- `playbookVersion`
- `scenarioId`
- `generatedAt`
- `governanceMode`
- `redactionBoundary`

Rejected conditions:

- missing source id;
- missing playbook identity;
- redaction boundary other than `required`;
- `raw_controlled_run` source kind.

### Sandbox Context

The sandbox context owns replay-local state only:

- replay id;
- sandbox id;
- replay mode;
- input;
- credential policy;
- approval policy;
- store policy;
- side-effect policy;

It must not own production stores or business asset targets.

### Credential Policy

Allowed credential modes:

- `none`
- `fake`
- `fixture`
- `replay_scoped`

Rejected credential modes:

- `live_api_key`
- `bearer_token`
- `connector_credential`
- `user_session`
- `production_account`
- `ambient`

### Approval Simulation

Allowed approval modes:

- `fixture_derived`
- `simulated`
- `require_record_only`

Rejected approval modes:

- `live_operator`
- `production_approval_store`

### Store Isolation

Allowed store modes:

- `none`
- `sandbox_snapshot`
- `fixture_only`

Rejected store access:

- production controlled run store;
- approval store;
- workflow run store;
- draft store;
- sales asset store;
- support asset store;
- knowledge asset store.

### Side-Effect Policy

Safe default:

- no LLM calls;
- no tool execution;
- no API route calls;
- no connector calls;
- no notifications;
- no file writes except replay result artifacts;
- no runtime store writes;
- no business asset writes.

Rejected side-effect targets:

- `llm_call`
- `tool_execution`
- `api_route_call`
- `connector_call`
- `webhook`
- `email`
- `notification`
- `runtime_store_write`
- `business_asset_write`
- `file_write_outside_replay_artifact`

### Replay Result Artifact

The result artifact shape should include:

- schema version;
- replay id;
- source provenance;
- sandbox id;
- replay mode;
- simulated approvals;
- blocked side-effect attempts;
- diagnostics;
- guarantees:
  - `toolCallsExecuted: false`
  - `assetsWritten: false`
  - `runtimeStoresMutated: false`
  - `productionCredentialsUsed: false`

## Validation Report

`validateReplaySandboxContract(contract)` returns:

```ts
type ReplaySandboxContractValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
    runtimeStoresMutated: false;
    productionCredentialsUsed: false;
  };
};
```

Stable error messages should name the unsafe boundary:

- `Replay input sourceId is required`
- `Replay input raw_controlled_run is not allowed`
- `Live replay credential live_api_key is not allowed`
- `Replay approval mode live_operator is not allowed`
- `Replay store access sales_asset_store is not allowed`
- `Replay side effect business_asset_write is not allowed`

## Acceptance Criteria

- A safe no-side-effect replay sandbox contract validates with `ok: true`.
- The validator rejects raw controlled run input.
- The validator rejects live credential modes.
- The validator rejects live approval modes.
- The validator rejects production store access.
- The validator rejects business asset writes and other side effects.
- The validation report preserves no-side-effect guarantees.
- The new test is included in `npm run test:controlled-runtime`.
- Docs record Phase 10w as completed and move next work to a no-side-effect
  replay sandbox prototype design only after contracts are stable.

## Verification

TDD verification:

```bash
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts
```

Phase verification:

```bash
git diff --check
npm run test:controlled-runtime
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Broader gates if code/doc changes remain small but stable:

```bash
npm run test:core-workflows
```
