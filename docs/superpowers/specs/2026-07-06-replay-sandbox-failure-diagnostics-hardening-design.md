# Replay Sandbox Failure Diagnostics Hardening Design

Last updated: 2026-07-06

## Context

The replay sandbox catalog path now has:

- `buildReplaySandboxCatalogReport()` for committed governed fixtures;
- `npm run replay:sandbox:fixtures` for compact JSON CI output;
- a test-only failure harness proving contract build failures exit non-zero.

Current failed output preserves flat `errors`, `contractErrors`, artifact status,
and artifact diagnostics. That is enough for broken fixture metadata, but it
does not clearly classify future sandbox failures or guarantee violations.

The next hardening step should stabilize failure taxonomy before any real replay
work starts.

## Goal

Add deterministic diagnostics classification for replay sandbox catalog report
failures:

- contract bridge / contract build failure;
- sandbox artifact failure;
- no-side-effect guarantee violation.

The command output should let maintainers identify which layer failed without
reading implementation internals.

## Non-Goals

This phase does not implement:

- real LLM replay;
- tool replay;
- API route calls;
- runtime store reads/writes;
- fixture JSON mutation or refresh;
- business asset writes;
- Runtime Console UI;
- new committed failing fixture JSON.

## Chosen Approach

Extend the existing test-fixture report layer:

```text
src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts
src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts
```

Add a test-only injection seam to `buildReplaySandboxCatalogReport()`:

```ts
buildReplaySandboxCatalogReport(entries?, options?)
```

where `options.runSandbox` defaults to `runNoSideEffectReplaySandbox`.

This lets tests synthesize sandbox artifact failures and guarantee violations
without changing committed fixture JSON, route behavior, stores, or production
runtime modules.

## Report Item Additions

Each `ReplaySandboxCatalogReportItem` should include:

```ts
failureKind:
  | "contract_build_failed"
  | "sandbox_artifact_failed"
  | "guarantee_violation"
  | null;
guaranteeErrors: string[];
```

Classification rules:

1. If contract build fails:
   - `failureKind: "contract_build_failed"`;
   - `artifact: null`;
   - `errors` equals contract build errors;
   - `guaranteeErrors: []`.
2. If contract build succeeds and sandbox artifact status is `failed`:
   - `failureKind: "sandbox_artifact_failed"`;
   - `artifactDiagnostics` should preserve artifact diagnostics;
   - `errors` includes artifact diagnostics.
3. If sandbox artifact status is `succeeded` but guarantees are not preserved:
   - `failureKind: "guarantee_violation"`;
   - `guaranteeErrors` includes stable guarantee diagnostics;
   - `errors` includes guarantee diagnostics.
4. If all checks pass:
   - `failureKind: null`;
   - `errors: []`;
   - `guaranteeErrors: []`.

If multiple failure conditions are present after contract build succeeds,
artifact failure takes priority over guarantee violation because failed artifact
diagnostics describe the first sandbox rejection layer.

## Output Shape

Add fields to each failed item in compact JSON:

```ts
{
  failureKind: "contract_build_failed" | "sandbox_artifact_failed" | "guarantee_violation";
  guaranteeErrors: string[];
}
```

Existing fields stay stable:

- `contractBuildOk`;
- `contractErrors`;
- `artifactStatus`;
- `artifactDiagnostics`;
- `errors`.

Committed all-green command output remains:

- `ok: true`;
- `failedItems: []`;
- four guarantees set to `false`.

## Synthetic Coverage

Add tests, not committed failing fixtures:

- contract build failure using a cloned fixture with broken provenance/redaction;
- sandbox artifact failure using injected `runSandbox` returning a failed
  `ReplayResultArtifact`;
- guarantee violation using injected `runSandbox` returning a succeeded artifact
  with a deliberately violated guarantee through a local test cast.

The committed fixture catalog must stay all green.

## Safety Boundaries

This phase remains pure:

- no file writes;
- no route calls;
- no server store imports;
- no runtime store reads/writes;
- no tool execution;
- no LLM calls;
- no business asset writes;
- no Runtime Console events;
- no automatic fixture discovery.

Allowed:

- test-only synthetic fixture clones;
- injected pure sandbox runner functions in tests;
- compact JSON output shape changes for failed items.

## Tests

Add or extend:

```text
src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts
src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Required coverage:

- report item classifies contract build failures as
  `contract_build_failed`;
- report item classifies injected sandbox failed artifacts as
  `sandbox_artifact_failed`;
- report item classifies injected guarantee violations as
  `guarantee_violation`;
- compact output includes `failureKind` and `guaranteeErrors`;
- existing `npm run replay:sandbox:fixtures --silent` remains all green.

## Verification

Final verification for this phase:

```bash
git diff --check
npm run replay:sandbox:fixtures --silent
npm test -- src/__tests__/lib/executor/runtime/replay-sandbox-catalog-report.test.ts src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

## Next Phase

After failure diagnostics are stable, the next reasonable phase is replay
sandbox failure harness expansion: expose direct test-only harness modes for
contract, sandbox, and guarantee failures while keeping committed fixture
commands green.
