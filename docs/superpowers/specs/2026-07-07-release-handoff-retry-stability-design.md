# Release Handoff Retry Stability Design

Date: 2026-07-07

## Context

The release handoff flow now has a full aggregate gate and a local evidence
snapshot command:

```bash
npm run release:handoff:check
npm run release:handoff:snapshot
```

During the previous snapshot phase, one standalone `release:handoff:check` run
failed in the `test:core-workflows` child command at the existing
`server backed retry` regression:

```text
AssertionError [ERR_ASSERTION]: Failed syncs should retry automatically.
false !== true
```

The direct rerun of `npm run test:core-workflows` passed, and a fresh
`release:handoff:check` also passed. That points to a timing-sensitive
regression rather than a deterministic functional failure.

Investigation found a mismatch between the regression setup and the runtime
implementation:

- the regression config passes `retryBaseMs: 10` and `retryMaxMs: 20`;
- `createServerBackedListState()` currently forces explicit `retryBaseMs` to at
  least `100`;
- the regression waits a fixed `160ms` before asserting a retry happened.

Under normal load this often passes, but the fixed wait is too close to the
actual floored retry delay plus asynchronous scheduling overhead. The aggregate
handoff gate should not depend on this timing margin.

## Goal

Make the server-backed retry regression deterministic enough for the release
handoff gate while preserving production retry defaults.

The intended behavior is:

- production default retry timings remain unchanged when no config is supplied;
- explicit retry timings supplied by tests or local harnesses are honored;
- the core workflow regression no longer depends on a narrow timing margin;
- no release, publishing, UI, runtime product surface, or data model behavior is
  added.

## Non-Goals

- No publishing.
- No GitHub Release.
- No package upload.
- No dependency changes.
- No UI changes.
- No new route.
- No retry policy redesign.
- No changes to default production retry values.
- No broad refactor of `server-backed-list-state.ts`.

## Proposed Behavior

Update retry timing normalization in:

```text
src/lib/server-backed-list-state.ts
```

Current behavior:

```ts
const retryBaseMs = Math.max(100, config.retryBaseMs ?? 750);
const retryMaxMs = Math.max(retryBaseMs, config.retryMaxMs ?? 30_000);
```

Desired behavior:

```ts
const retryBaseMs =
  config.retryBaseMs === undefined ? 750 : Math.max(0, config.retryBaseMs);
const retryMaxMs =
  config.retryMaxMs === undefined ? 30_000 : Math.max(retryBaseMs, config.retryMaxMs);
```

This keeps the production defaults at `750ms` and `30_000ms`, while allowing a
bounded local regression to use `10ms` / `20ms`.

## Test Coverage

Add a focused Vitest file:

```text
src/__tests__/lib/server-backed-list-state.test.ts
```

Required coverage:

- a failed upsert retries using an explicit `retryBaseMs` below `100ms`;
- the retry queue drains after the successful retry;
- the sync status registry reports pending count `0` after the retry;
- fake timers are used so the test does not depend on real wall-clock timing.

Add this file to:

```text
npm run test:controlled-runtime
```

The test should fail before the implementation change because the explicit
`retryBaseMs: 10` is currently clamped to `100ms`.

## Regression Script Handling

The existing `scripts/regression/workflows.mjs` can keep the current
`retryBaseMs: 10`, `retryMaxMs: 20`, and `waitMs(160)` after the runtime fix,
because the explicit retry timing will now be honored.

If verification still shows timing drift after this fix, the next slice should
replace the fixed wait with a polling helper. That is intentionally out of this
first narrow fix.

## Documentation Updates

Update:

- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `memory/2026-07-07.md`

Docs should record:

- why this was done after the snapshot phase;
- the observed transient failure;
- the preserved default retry boundary;
- the updated `test:controlled-runtime` coverage count.

## Verification

Run:

```bash
npm test -- src/__tests__/lib/server-backed-list-state.test.ts
npm run test:core-workflows
npm run test:controlled-runtime
npm run release:handoff:check
npm run release:handoff:snapshot
npm run lint
npm run build
git diff --check
```

`release:handoff:snapshot` may generate a new local evidence file under
`output/release-handoff/`; do not stage generated evidence.

## Acceptance Criteria

- A new failing test proves explicit sub-100ms retry timing is honored.
- `createServerBackedListState()` keeps production defaults unchanged.
- `npm run test:core-workflows` passes after the fix.
- `npm run release:handoff:check` passes after the fix.
- Docs and memory record the gate stability slice and the known boundary.

## Spec Self-Review

- Placeholder scan: no placeholders remain.
- Scope check: one runtime timing normalization fix plus focused test and docs.
- Boundary check: no UI, publishing, dependencies, release artifacts, or broad
  retry redesign.
- Ambiguity check: explicit config below `100ms` is honored; omitted config
  keeps old defaults.
