# No-Side-Effect Replay Sandbox Prototype Design

## Context

Phase 10v defined the real replay boundary in
`docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`.

Phase 10w encoded that boundary as TypeScript-only contracts in
`src/lib/executor/runtime/replay-sandbox-contracts.ts` with tests in
`src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`.

The project now needs a design for the smallest no-side-effect replay sandbox
prototype before implementation starts. The prototype must consume a validated
`ReplaySandboxContract` and emit only a replay result artifact. It must not
execute tools, call routes, read/write runtime stores, or write assets.

## Goal

Design the minimal no-side-effect replay sandbox prototype.

The design should define:

- prototype inputs;
- preflight validation;
- replay-local state ownership;
- step cursor behavior;
- approval simulation behavior;
- side-effect interception model;
- replay result artifact output;
- failure and diagnostics semantics;
- verification gates for the later implementation phase.

## Non-Goals

- Do not implement the prototype in this phase.
- Do not replay LLM output.
- Do not execute tools or tool simulators.
- Do not call API routes.
- Do not read or write runtime stores.
- Do not write business assets.
- Do not add package scripts.
- Do not add fixture JSON.
- Do not change Runtime Console UI.
- Do not modify current metadata fixture replay behavior.

## Source Inventory

- Boundary guide:
  `docs/REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md`
- Contract module:
  `src/lib/executor/runtime/replay-sandbox-contracts.ts`
- Contract tests:
  `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`
- Metadata replay:
  `src/lib/executor/runtime/trace-replay.ts`
- Fixture builder / validator:
  `src/lib/executor/runtime/trace-fixtures.ts`
- Fixture catalog report:
  `src/__tests__/fixtures/controlled-traces/catalog-report.ts`
- Current backlog:
  `docs/NEXT_STEPS.md`
- Runtime manual:
  `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`

## Design Options

### Option A. Design-Only Prototype Contract

Write a maintainer-facing design guide that defines the future prototype module,
input/output contract, preflight behavior, diagnostics, and stop conditions.

Trade-off: no executable prototype exists yet, but implementation stays
deliberate and reviewable.

### Option B. Implement A Skeleton Prototype Now

Add a `runNoSideEffectReplaySandbox()` function that validates a contract and
returns a result artifact without processing steps.

Trade-off: even a skeleton can be mistaken for implemented replay behavior.

### Option C. Extend Existing Fixture Replay

Fold prototype behavior into `trace-replay.ts`.

Trade-off: this blurs metadata fixture replay with future sandbox replay and
weakens the current no-side-effect boundary.

## Chosen Approach

Use Option A for Phase 10x.

This phase is documentation/design only. The next implementation phase may add a
small new module, but only after this design is accepted.

## Prototype Design

### Proposed Future Module

Future implementation should create:

```text
src/lib/executor/runtime/replay-sandbox.ts
```

The module should export:

```ts
runNoSideEffectReplaySandbox(contract: ReplaySandboxContract): ReplayResultArtifact
```

The function name is intentional:

- `run` means it processes replay-local state;
- `NoSideEffect` is part of the API surface;
- `ReplaySandbox` separates it from current metadata fixture replay.

### Input

The prototype accepts only `ReplaySandboxContract`.

It does not accept:

- raw controlled run records;
- `ControlledTraceFixture` directly;
- `ControlledTraceArtifact` directly;
- workflow run ids;
- asset ids;
- route request objects;
- store handles.

Callers must build or select a contract before invoking the prototype.

### Preflight

The first operation is:

```ts
const validation = validateReplaySandboxContract(contract);
```

If validation fails, the prototype must return a replay result artifact with:

- `ok: false` or equivalent failure status;
- validation errors in diagnostics;
- no step cursor advancement;
- no simulated approval decisions beyond contract-provided data;
- no side-effect attempts.

The prototype must not throw for ordinary unsafe contract input. It should
return a failure artifact so the caller can inspect diagnostics without causing
runtime side effects.

### Replay-Local State

The prototype owns only replay-local state:

- replay id;
- sandbox id;
- current replay cursor;
- replay-local step summaries;
- simulated approval list;
- blocked side-effect attempts;
- diagnostics;
- result artifact.

It does not own or reference:

- controlled execution store;
- approval store;
- workflow run store;
- draft store;
- sales asset store;
- support asset store;
- knowledge asset store;
- Runtime Console state.

### Step Cursor

The first prototype should not reconstruct business content.

It may record a cursor over contract/source metadata:

- `preflight`;
- `load_source_metadata`;
- `simulate_approvals`;
- `block_side_effects`;
- `emit_result_artifact`;

It should not claim that playbook business steps were re-executed.

### Approval Simulation

Approval simulation is metadata-only.

Allowed:

- copy `contract.approvalPolicy.simulatedDecisions` into the result artifact;
- record that production approval would have been required;
- record missing simulated approval as a diagnostic.

Disallowed:

- create durable approvals;
- call approval APIs;
- ask the operator for a live approval;
- mark production approvals approved/rejected.

### Side-Effect Interception

The prototype should treat every side effect as blocked by default.

The result artifact should expose a stable list such as:

```ts
blockedSideEffects: ReplaySideEffect[]
```

The prototype should not attempt any side effect and then mark it blocked. It
should derive blocked attempts from the contract and sandbox policy before
execution.

### Output

The only output is a replay result artifact.

The artifact should include:

- schema version;
- replay id;
- sandbox id;
- source provenance;
- replay mode;
- status;
- cursor events;
- simulated approvals;
- blocked side effects;
- diagnostics;
- no-side-effect guarantees.

The artifact must not be shaped like:

- controlled run record;
- writeback receipt;
- workflow run;
- draft;
- business asset.

## Stop Conditions

Do not implement the prototype if the implementation plan requires:

- LLM replay;
- tool execution;
- API route calls;
- runtime store reads;
- runtime store writes;
- business asset writes;
- fixture JSON changes;
- Runtime Console UI changes;
- raw governed artifact payload recovery.

## Acceptance Criteria

- A design guide exists for the no-side-effect replay sandbox prototype.
- The guide names a future module boundary without implementing it.
- The guide requires `validateReplaySandboxContract()` as preflight.
- The guide defines failure artifact behavior for unsafe contracts.
- The guide defines replay-local state and explicitly excludes runtime stores.
- The guide defines metadata-only approval simulation.
- The guide defines side-effect interception before execution.
- The guide defines replay result artifact ownership.
- Entry docs point to the design and set the next phase to prototype
  implementation.
- No runtime code changes are made in this design phase.

## Verification

Minimum:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Preferred:

```bash
npm run test:controlled-runtime
```
