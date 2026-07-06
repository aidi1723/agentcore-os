# Governed Trace Fixture Refresh Workflow

Last updated: 2026-07-06

## 1. Purpose

This guide is the manual refresh path for committed governed trace fixtures.

Use it when a controlled playbook changes and `npm run trace:fixtures --silent` shows fixture drift, or when a known-good governed trace artifact should replace a stale fixture.

This workflow is intentionally manual. The builder command prints fixture JSON to stdout. A maintainer reviews the generated JSON and decides whether to replace a committed fixture file.

If `npm run trace:fixtures --silent` fails, first read [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md) to identify whether the failure is playbook drift, stale fixture metadata, or an unsafe candidate fixture.

## 2. Hard Boundaries

Do not add automation that bypasses review:

- no automatic committed fixture writeback;
- no filesystem discovery of runtime artifacts;
- no Runtime Console or API route changes;
- no LLM replay;
- no tool execution;
- no runtime store reads or writes;
- no asset writes.

## 3. Required Inputs

You need one governed trace artifact JSON file. It should come from the governed trace artifact route or Runtime Console governed trace copy action.

The artifact must already be inside the trace governance boundary:

- raw step input is redacted;
- raw step output is redacted;
- tool output is redacted;
- approval feedback is redacted;
- audit messages are redacted;
- free-form plan text is redacted.

## 4. Build Candidate Fixture

Save the governed artifact to a temporary local file:

```bash
/tmp/governed-trace-artifact.json
```

Build a candidate fixture:

```bash
npm run trace:fixture:build -- /tmp/governed-trace-artifact.json > /tmp/governed-trace-fixture.json
```

The redirection is a maintainer action. The builder command itself only writes to stdout.

If the command exits non-zero, do not replace any committed fixture. Fix the artifact source or inspect stderr.

## 5. Review Candidate Fixture

Before replacing a committed fixture file, inspect `/tmp/governed-trace-fixture.json`.

Use the replay contract matrix as the interpretation layer for every failed `failedItems[].diagnostics` field.

Required checks:

- `schemaVersion` is `controlled-trace-fixture/v1`;
- `playbookId` is the intended controlled playbook;
- `playbookVersion` is the intended playbook version;
- `assertions.stepOrder` matches the current playbook step order;
- each approval-gated step has `approvalState`;
- each playbook writeback target appears on the same fixture step;
- each step has `hasRedactedInput: true`;
- each step has `hasRedactedOutput: true`;
- each tool call has `outputRedacted: true`;
- writeback metadata has stable `target`, `assetId`, `sourceKey`, and `workflowRunId` where applicable;
- serialized fixture JSON does not contain raw customer names, emails, secrets, API keys, prompt text, or tool output payloads.

Also review the generated file with:

```bash
rg "sk-|api[_-]?key|secret|password|token|@|Nora|raw" /tmp/governed-trace-fixture.json
```

Adjust the search terms for the actual sensitive strings known in the source run.

## 6. Replace Fixture Manually

Only after review, replace the intended committed fixture file manually.

Current committed fixture files live under:

```text
src/__tests__/fixtures/controlled-traces/
```

Examples:

```text
src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json
src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json
```

Do not add the temporary artifact file to git.

## 7. Verify Catalog Health

Run:

```bash
npm run trace:fixtures --silent
```

Expected:

- `ok: true`;
- `failed: 0`;
- `guarantees.toolCallsExecuted: false`;
- `guarantees.assetsWritten: false`.

If this fails, inspect `failedItems[].replayErrors` and `failedItems[].diagnostics`, then use the replay contract guide to decide whether to update the playbook, refresh the fixture, or reject the artifact source.

## 8. Verify Runtime Gate

Run:

```bash
npm run test:controlled-runtime
```

For a normal docs/fixture refresh, also run:

```bash
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

`lint` and `build` may still show the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## 9. Review Git Diff

Before committing, inspect:

```bash
git diff -- src/__tests__/fixtures/controlled-traces/
```

Confirm the diff changes only governed fixture metadata and does not introduce raw payloads.

## 10. Commit Guidance

Use a focused commit:

```bash
git add src/__tests__/fixtures/controlled-traces/<fixture>.fixture.json
git commit -m "test: refresh governed trace fixture"
```

If documentation changes accompany the refresh, commit them separately unless they are inseparable from the fixture update.
