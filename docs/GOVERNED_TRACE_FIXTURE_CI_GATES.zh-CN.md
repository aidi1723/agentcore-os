# Governed Trace Fixture CI Gates

Last updated: 2026-07-06

## 1. Purpose

This guide explains how to use governed trace fixture replay commands as local and CI-style gates.

Use this guide with:

- [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md)
- [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)

## 2. Hard Boundaries

Fixture replay gates are metadata gates only:

- no LLM replay;
- no tool execution;
- no API route calls;
- no runtime store reads or writes;
- no asset writes;
- no automatic fixture discovery;
- no automatic fixture refresh.

## 3. Command Roles

| Command | Primary use | Output contract | Automation status |
| --- | --- | --- | --- |
| `npm run trace:fixtures --silent` | CI-style and scriptable fixture health gate | Stable JSON report with `ok`, counts, ids, failed items, diagnostics, and no-side-effect guarantees | Use for automation |
| `npm run trace:fixtures:summary --silent` | Local human triage and review | Human-readable summary over the same report | Do not parse in automation |
| `npm run trace:fixture:build -- <artifact.json>` | Manual candidate fixture generation from a governed artifact | Fixture JSON on stdout or stable stderr diagnostics on failure | Use only in refresh workflow |

Automation should consume only `trace:fixtures` JSON. Summary text can change for readability.

## 4. Local Development Gate

Run before committing playbook, replay, fixture, or trace-governance changes:

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Expected:

- JSON gate reports `ok: true`;
- `total` equals the committed fixture catalog size;
- `failed` is `0`;
- summary prints `Status: OK`;
- guarantees remain `toolCallsExecuted=false` and `assetsWritten=false`.

## 5. Fixture Refresh Gate

During fixture refresh, use this order:

```bash
npm run trace:fixture:build -- /tmp/governed-trace-artifact.json > /tmp/governed-trace-fixture.json
npm run trace:fixtures:summary --silent
npm run trace:fixtures --silent
npm run test:controlled-runtime
```

Do not replace committed fixture JSON until the candidate passes the refresh review checklist.

After replacement, `trace:fixtures` must be green before committing.

## 6. CI-Style Gate

For CI-style automation, run:

```bash
npm run trace:fixtures --silent
```

Gate rule:

- exit `0` and `ok: true` means the committed governed fixture catalog is compatible with the current playbook contracts;
- non-zero exit or `ok: false` blocks the gate;
- automation should store stdout as the replay report artifact when available.

`npm run trace:fixtures:summary --silent` may be run after a failure for human logs, but it is not the stable machine contract.

## 7. Failure Interpretation

When a gate fails:

1. Read `failedItems[].validationErrors`.
2. Read `failedItems[].replayErrors`.
3. Read `failedItems[].diagnostics`.
4. Classify the failure through the replay contract failure fixture matrix.
5. Decide between playbook fix, fixture refresh, governed artifact source fix, or rejected candidate.

Do not refresh fixtures simply because CI failed.

## 8. Output Stability Contract

Stable for automation:

- `trace:fixtures` exit code;
- `trace:fixtures` JSON top-level fields;
- `failedItems[].validationErrors`;
- `failedItems[].replayErrors`;
- `failedItems[].diagnostics`;
- no-side-effect guarantees.

Not stable for automation:

- `trace:fixtures:summary` wording;
- ordering of prose lines in the summary;
- local command timing/log formatting.

## 9. What Green Gates Prove

Green gates prove committed governed fixture metadata still matches the current controlled playbook contract and preserves no-side-effect replay boundaries.

Green gates do not prove LLM output quality, tool behavior, runtime store state, asset business validity, or production replay safety.
