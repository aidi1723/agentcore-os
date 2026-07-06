# Governed Trace Operational Runbook

Last updated: 2026-07-06

## 1. Purpose

This runbook is the ordered maintainer path for governed trace lifecycle work.

Use it when you need to export a governed trace artifact, decide whether it should become a fixture candidate, refresh a committed fixture, run replay gates, or reason about retention and future real replay boundaries.

Use it with:

- [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)
- [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md)
- [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)
- [Governed Trace Fixture Catalog Coverage](GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md)

## 2. Hard Boundaries

This runbook does not grant permission to bypass trace governance:

- no raw controlled run records as fixture sources;
- no LLM replay;
- no tool execution;
- no API route calls during fixture replay;
- no runtime store reads or writes during fixture replay;
- no asset writes during fixture replay;
- no automatic fixture discovery;
- no automatic committed fixture refresh;
- no unrestricted external sharing of governed artifacts.

## 3. Lifecycle Overview

| Stage | Action | Owner | Output | Stop condition |
| --- | --- | --- | --- | --- |
| Export | Copy or fetch governed trace artifact | Operator / maintainer | `{ export, artifact }` JSON | Raw run record or unredacted payload appears |
| Classify | Decide audit-only, fixture candidate, or reject | Maintainer | Intent decision | Artifact lacks source identity, redaction, approval, or writeback identity |
| Build | Convert governed artifact to fixture candidate | Maintainer | `/tmp/governed-trace-fixture.json` | Builder exits non-zero |
| Review | Apply refresh checklist | Maintainer | Accepted or rejected candidate | Candidate needs manual redaction or receipt edits |
| Gate | Run replay and runtime gates | Maintainer / CI | JSON report, summary, test results | `trace:fixtures` fails or runtime tests fail |
| Retain / prune | Apply retention policy after export/review needs are satisfied | Maintainer | Old terminal runs pruned by policy | Run is active, awaiting approval, or needed for current review |
| Handoff | Record decision and next action | Maintainer | Commit, issue, or rejected candidate note | Ownership or next step unclear |

## 4. Export Governed Artifact

Preferred sources:

- Runtime Console selected run action: `复制脱敏 Trace`;
- local route: `GET /api/runtime/executor/controlled-runs/[runId]/trace-artifact`.

The exported shape is:

```json
{
  "ok": true,
  "data": {
    "export": {
      "filename": "controlled-trace-<runId>-<generatedAt>.json",
      "generatedAt": 0,
      "contentType": "application/json",
      "governanceMode": "fixture"
    },
    "artifact": {}
  }
}
```

Save only the governed artifact payload for fixture building:

```bash
/tmp/governed-trace-artifact.json
```

Reject the export if raw customer text, prompt text, tool output, approval feedback, audit messages, secrets, API keys, or bearer tokens appear in the serialized JSON.

## 5. Classify The Artifact

Choose exactly one intent:

| Intent | Use when | Next action |
| --- | --- | --- |
| Audit only | You need local investigation or handoff, but no playbook/fixture drift exists | Keep inside local review notes; do not commit |
| Fixture candidate | Current playbook changed intentionally, or catalog coverage rules justify a new/updated committed fixture | Build candidate fixture |
| Reject | Redaction, source identity, approval, schema, or writeback identity is unsafe or incomplete | Fix source route/writeback metadata or re-export |

Do not build fixtures merely because a trace is interesting. Fixture candidates must preserve a durable contract.

## 6. Build Candidate Fixture

Run:

```bash
npm run trace:fixture:build -- /tmp/governed-trace-artifact.json > /tmp/governed-trace-fixture.json
```

The builder command prints to stdout. The redirection is a maintainer action.

If the command exits non-zero:

- do not edit the candidate by hand;
- inspect stderr;
- fix the governed artifact source or choose a better source run.

## 7. Review Candidate Fixture

Before replacing any committed fixture, follow the checklist in [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md#5-review-candidate-fixture).

Minimum local checks:

```bash
rg "sk-|api[_-]?key|secret|password|token|@|Nora|raw|Bearer " /tmp/governed-trace-fixture.json
git diff -- src/__tests__/fixtures/controlled-traces/
```

Any sensitive string match must be explained as safe metadata or the candidate is rejected.

## 8. Run Replay And Runtime Gates

For human triage:

```bash
npm run trace:fixtures:summary --silent
```

For automation and blocking decisions:

```bash
npm run trace:fixtures --silent
```

For runtime coverage:

```bash
npm run test:controlled-runtime
```

For normal committed changes:

```bash
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

## 9. Failure Escalation

| Failure | Meaning | Action |
| --- | --- | --- |
| Fixture validation failure | Candidate shape, identity, or redaction is unsafe | Reject candidate or fix governed artifact source |
| Replay drift | Candidate or committed fixture no longer matches current playbook | Confirm playbook contract before refreshing |
| Missing stable writeback metadata | Successful receipt cannot identify written asset | Fix writeback receipt source or re-export |
| Summary/harness mismatch | Test harness or human summary behavior changed | Fix tests/tooling; do not alter committed fixtures to satisfy harness behavior |
| Runtime gate failure | Controlled runtime behavior regressed | Stop fixture work and fix runtime behavior first |

Start failure classification from [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md#6-failure-fixture-matrix).

## 10. Retention And Cleanup

`previewControlledExecutionRunRetention()` is the dry-run retention helper. Run it before cleanup to inspect the normalized policy, cutoff, kept/pruned run ids, and per-run retention reasons.

Preferred local command:

```bash
npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20
```

For an explicit workspace or test fixture directory:

```bash
npm run trace:retention:preview -- --cwd /path/to/workspace --now 10000 --max-age-ms 1000 --min-terminal-runs 1
```

`pruneControlledExecutionRuns()` is the mutating retention helper. It uses the same decision model as preview, then prunes old terminal runs while preserving active and approval-blocked runs according to policy.

Before pruning, confirm:

- no active fixture refresh depends on the run;
- governed artifact export is complete if the run is needed for audit;
- `running` and `awaiting_approval` runs are not targeted for cleanup;
- minimum terminal-run retention is acceptable for the current review window.
- preview reasons are understood:
  - `active_run` and `approval_blocked` must stay;
  - `minimum_terminal_retention` protects newest terminal runs;
  - `within_retention_window` stays because it is newer than the cutoff;
  - `expired_terminal_run` is the only cleanup candidate.

Retention is not a substitute for fixture refresh. If a run is needed as fixture source, export and review it before cleanup.

## 11. Real Replay Boundary

Current replay is metadata compatibility only. It proves that committed governed fixture metadata still matches current playbook contracts and preserves no-side-effect guarantees.

Current replay does not:

- replay LLM output;
- execute tools;
- call API routes;
- read or write runtime stores;
- write business assets;
- prove business correctness of original outputs.

Future real replay boundaries are defined in [Real Replay Boundary Design](REAL_REPLAY_BOUNDARY_DESIGN.zh-CN.md).

The next allowed phase is Replay Sandbox Contract Types. It may define TypeScript-only contracts for replay input provenance, sandbox context, credential policy, approval simulation, store isolation, side-effect policy, and replay result artifacts. It must still avoid LLM replay, tool execution, route calls, runtime store reads/writes, and business asset writes.
