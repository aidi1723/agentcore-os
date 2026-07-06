# Replay Sandbox Catalog CI Summary Design

Last updated: 2026-07-06

## Context

Phase 10aa added a pure catalog-level replay sandbox report:

```text
committed fixture catalog -> ReplaySandboxContract -> no-side-effect replay result artifact
```

The report is currently available only as a TypeScript helper:

```text
src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts
```

The next gap is a local CI-style command that exposes this report as compact
JSON and exits non-zero when any committed fixture cannot enter the
no-side-effect replay sandbox path.

## Goal

Add a local command that:

- builds `buildReplaySandboxCatalogReport()` over committed governed fixtures;
- prints parseable compact JSON to stdout;
- writes no stderr on success;
- exits `0` when the report is green;
- exits non-zero when the report is not green;
- preserves the no-side-effect replay boundary.

## Non-Goals

This phase does not implement:

- real LLM replay;
- tool replay;
- API route calls;
- runtime store reads/writes;
- fixture JSON mutation or refresh;
- business asset writes;
- Runtime Console UI;
- human-readable replay sandbox summary;
- automatic fixture discovery.

## Chosen Approach

Create:

```text
src/__tests__/fixtures/controlled-traces/replay-sandbox-report-output.ts
scripts/trace-fixtures/replay-sandbox-catalog-report.mjs
scripts/trace-fixtures/replay-sandbox-failure-harness.mjs
src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Add package script:

```json
"replay:sandbox:fixtures": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/replay-sandbox-catalog-report.mjs"
```

The command name is intentionally separate from `trace:fixtures`:

- `trace:fixtures` remains the governed trace fixture replay gate;
- `replay:sandbox:fixtures` becomes the sandbox contract/artifact gate over the
  same committed fixture catalog.

## Output Shape

The command should print JSON with:

```ts
{
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  failedItems: Array<{
    catalogId: string;
    fixtureId: string;
    playbookId: string;
    contractBuildOk: boolean;
    contractErrors: string[];
    artifactStatus: "succeeded" | "failed" | null;
    artifactDiagnostics: string[];
    errors: string[];
  }>;
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
    runtimeStoresMutated: false;
    productionCredentialsUsed: false;
  };
}
```

Successful committed fixture output should have:

- `ok: true`;
- `total: 2`;
- `failed: 0`;
- `failedItems: []`;
- all four guarantees set to `false`.

Failed output should keep enough diagnostics for maintainers to decide whether
the fixture, contract bridge, sandbox validator, or playbook contract drifted.

## Failure Harness

The default command reads only committed all-green fixtures. To prove non-zero
exit behavior without breaking committed fixtures, add a test-only direct
harness:

```text
scripts/trace-fixtures/replay-sandbox-failure-harness.mjs
```

The harness should:

- clone the committed sales fixture;
- break fixture provenance / redaction metadata;
- build a one-entry `buildReplaySandboxCatalogReport([...])`;
- print the same compact JSON output shape;
- exit `1`.

Do not add an npm script for the harness. Tests can invoke it directly with the
same TypeScript alias loader.

## Safety Boundaries

Both scripts must remain pure:

- no file reads beyond normal module loading;
- no file writes;
- no route calls;
- no server store imports;
- no runtime store reads/writes;
- no tool execution;
- no LLM calls;
- no business asset writes;
- no Runtime Console events;
- no automatic fixture discovery.

Allowed imports:

- explicit committed fixture catalog helpers;
- replay sandbox catalog report helper;
- compact output helper.

## Tests

Add:

```text
src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
```

Required coverage:

- `npm run replay:sandbox:fixtures --silent` exits `0`;
- stdout is parseable JSON;
- stderr is empty;
- output reports current committed sales/support fixtures as all green;
- output includes four no-side-effect guarantees;
- direct failure harness exits `1`;
- direct failure harness emits parseable failed JSON with contract errors and
  `artifactStatus: null`.

Add the test to `npm run test:controlled-runtime`.

## Verification

Final verification for this phase:

```bash
git diff --check
npm run replay:sandbox:fixtures --silent
npm test -- src/__tests__/scripts/replay-sandbox-catalog-report-script.test.ts
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
npm run test:controlled-runtime
npm run test:core-workflows
```

## Next Phase

After this command exists, the next reasonable phase is replay sandbox failure
diagnostics hardening: add synthetic sandbox/contract failure coverage to keep
future CLI diagnostics stable without adding failing committed fixture JSON.
