# Governed Trace Fixture Builder CLI Design

## Context

Phase 10h added `npm run trace:fixtures` so maintainers can check the committed governed fixture catalog from one local command. The remaining fixture maintenance gap is refresh: a maintainer can export a governed trace artifact, but turning that artifact into a reviewed fixture still requires manual JSON manipulation.

This phase adds a narrow local builder command. It reads one governed trace artifact JSON file, converts it through the existing fixture builder, validates the result, and prints fixture JSON to stdout. It does not write fixture files, discover runtime traces, call routes, replay tools, or mutate stores.

## Goals

- Add a local command that accepts a governed trace artifact JSON file path.
- Build the fixture with `buildControlledTraceFixture()`.
- Validate the fixture with `validateControlledTraceFixture()` before printing success output.
- Print parseable fixture JSON to stdout on success.
- Print clear errors to stderr and exit non-zero on missing arguments, unreadable files, invalid JSON, or invalid fixture output.
- Add subprocess coverage for success and invalid input behavior.
- Include the command test in `test:controlled-runtime`.

## Non-Goals

- No API route.
- No Runtime Console or UI changes.
- No filesystem discovery of artifacts or fixtures.
- No automatic writes to committed fixture files.
- No LLM replay.
- No tool execution.
- No runtime store reads or writes.
- No asset writeback.
- No catalog mutation.

## Proposed Design

Create:

`scripts/trace-fixtures/build-fixture.mjs`

Run through the existing TypeScript alias loader:

```bash
node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/build-fixture.mjs path/to/artifact.json
```

Add npm script:

```json
"trace:fixture:build": "node --import ./scripts/register-ts-alias-loader.mjs ./scripts/trace-fixtures/build-fixture.mjs"
```

Behavior:

1. Read the first positional argument as the artifact JSON path.
2. If no path is provided, print `Usage: npm run trace:fixture:build -- <artifact.json>` to stderr and exit `1`.
3. Read the file with `fs.readFile()`.
4. Parse JSON.
5. Call `buildControlledTraceFixture(artifact)`.
6. Call `validateControlledTraceFixture(fixture)`.
7. If validation fails, print each validation error to stderr and exit `1`.
8. On success, print only `JSON.stringify(fixture, null, 2)` to stdout.

The command intentionally trusts the existing fixture validator instead of duplicating schema checks in the script. Runtime safety remains concentrated in `trace-fixtures.ts`.

## Output Contract

Success stdout:

```json
{
  "schemaVersion": "controlled-trace-fixture/v1",
  "fixtureId": "controlled-trace-fixture:<run-id>",
  "sourceRunId": "<run-id>",
  "playbookId": "<playbook-id>",
  "steps": []
}
```

Success stderr must be empty.

Failure stdout must be empty. Failure stderr must include one of:

- usage text for a missing argument;
- `Failed to read governed trace artifact` for unreadable input;
- `Failed to parse governed trace artifact JSON` for malformed JSON;
- `Governed trace artifact did not produce a valid fixture` followed by validation errors.

## Testing

Create:

`src/__tests__/scripts/trace-fixture-builder-script.test.ts`

Coverage:

- Success path:
  - create a temporary governed trace artifact JSON file in a test temp directory;
  - spawn `npm run trace:fixture:build --silent -- <artifactPath>`;
  - assert exit `0`;
  - assert stderr is empty;
  - parse stdout as fixture JSON;
  - assert schema version, source run id, playbook id, step order, approval state, writeback metadata, and redaction flags;
  - assert serialized output does not contain known raw secret/customer strings from the artifact fixture.
- Invalid artifact path:
  - spawn the command with a missing file;
  - assert non-zero exit;
  - assert stdout is empty;
  - assert stderr includes `Failed to read governed trace artifact`.

The success test should use an inline minimal governed artifact instead of reading committed fixture files, so the builder command is tested independently from catalog health.

## Acceptance Criteria

- `npm run trace:fixture:build --silent -- <artifact.json>` prints parseable governed fixture JSON for a valid governed artifact.
- The command exits non-zero and writes diagnostics to stderr for unreadable or invalid input.
- The command never writes fixture files or runtime data.
- `test:controlled-runtime` includes the builder CLI subprocess test.
- Existing fixture catalog summary, controlled runtime, core workflow, lint, build, and diff checks pass.
