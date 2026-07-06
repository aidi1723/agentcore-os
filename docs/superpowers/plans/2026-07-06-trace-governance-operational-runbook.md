# Trace Governance Operational Runbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operational runbook that gives maintainers one ordered lifecycle for governed trace artifacts, fixture refresh, replay gates, retention, and real replay boundaries.

**Architecture:** This is a docs-only trace governance phase. The new runbook owns end-to-end operating order and links to existing detailed guides for refresh checks, replay diagnostics, CI gates, and catalog coverage.

**Tech Stack:** Markdown documentation, existing trace fixture npm commands, existing controlled runtime verification commands.

---

## File Structure

- Create: `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
  - New maintainer runbook for governed trace lifecycle operations.
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
  - Link the runbook from the purpose section.
- Modify: `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
  - Link the runbook in the companion docs list.
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - Add the runbook to internal engineering docs.
- Modify: `CHANGELOG.md`
  - Record Phase 10u.
- Modify: `docs/NEXT_STEPS.md`
  - Mark Phase 10u complete and set the next recommended phase.
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Add Phase 10u progress and next direction.
- Modify: `docs/superpowers/plans/2026-07-06-trace-governance-operational-runbook.md`
  - Track implementation and verification evidence.
- Modify: `memory/2026-07-06.md`
  - Record local continuity; do not stage this file.

## Task 1: Add Operational Runbook

**Files:**
- Create: `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`

- [ ] **Step 1: Write purpose and boundaries**

Create the runbook with:

```markdown
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
```

- [ ] **Step 2: Add lifecycle stages**

Add:

```markdown
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
```

- [ ] **Step 3: Add artifact export and classification**

Add:

```markdown
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
```

- [ ] **Step 4: Add build/review/gate flow**

Add:

````markdown
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
````

- [ ] **Step 5: Add escalation, retention, and real replay boundaries**

Add:

```markdown
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

`pruneControlledExecutionRuns()` is the current retention helper. It prunes old terminal runs while preserving active and approval-blocked runs according to policy.

Before pruning, confirm:

- no active fixture refresh depends on the run;
- governed artifact export is complete if the run is needed for audit;
- `running` and `awaiting_approval` runs are not targeted for cleanup;
- minimum terminal-run retention is acceptable for the current review window.

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

Future real replay requires a separate design covering tool sandboxing, credential isolation, approval simulation, store isolation, side-effect blocking, and replay result ownership.
```

## Task 2: Cross-Link Runbook

**Files:**
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Modify: `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`

- [ ] **Step 1: Link from refresh workflow**

Add near the purpose section:

```markdown
For the full artifact export, classification, fixture refresh, replay gate, retention, and handoff lifecycle, see [Governed Trace Operational Runbook](GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md).
```

- [ ] **Step 2: Link from CI gates**

Add to the companion docs list:

```markdown
- [Governed Trace Operational Runbook](GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)
```

- [ ] **Step 3: Link from documentation index**

Add beside the governed trace fixture docs:

```markdown
- [Governed Trace Operational Runbook](GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)
```

## Task 3: Align Project Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update changelog**

Add:

```markdown
### Trace Governance Operational Runbook

- Added a governed trace operational runbook covering artifact export, artifact intent classification, candidate fixture generation, refresh review, replay gates, retention, and handoff.
- Clarified stop conditions for unsafe artifacts, replay drift, missing stable writeback metadata, runtime gate failures, and summary/harness mismatches.
- Documented that current replay remains metadata-only and that real LLM/tool replay requires a separate design with side-effect controls.
```

- [ ] **Step 2: Update Next Steps**

Add the runbook to the completed baseline and add:

```markdown
## Completed. Trace Governance Operational Runbook

Why:

- Trace governance had export, refresh, replay, CI gate, and catalog coverage docs, but no ordered maintainer lifecycle.
- Maintainers needed a single runbook that prevents command-order mistakes and keeps metadata replay separate from real replay.

Delivered:

- Added `docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`.
- Documented export, artifact classification, fixture candidate build, candidate review, replay gates, failure escalation, retention, and handoff.
- Added explicit real replay boundaries.

Outcome:

- Governed trace operations now have one entry point.
- Future real replay work is clearly separated from current no-side-effect metadata replay.

## Recommended Next. Real Replay Boundary Design
```

Set recommended next scope to a design-only review for real replay sandbox/side-effect boundaries.

- [ ] **Step 3: Update controlled runtime manual**

Add the runbook link to the phase list and progress:

```markdown
- Phase 10u trace governance operational runbook：已新增 governed trace operational runbook，把 artifact export、intent classification、fixture candidate build、refresh review、catalog gates、retention cleanup、failure escalation 和 real replay boundary 串成维护者执行路径。
```

Set next phase to:

```markdown
Phase 10v. Real Replay Boundary Design
```

- [ ] **Step 4: Update local memory**

Append:

```markdown
## Trace Governance Operational Runbook completed

- Implemented Phase 10u docs-only governance operations slice.
- Added governed trace operational runbook as the single maintainer entry point.
- Next recommended phase: Real Replay Boundary Design.
```

Do not stage `memory/2026-07-06.md`.

## Task 4: Verify And Commit

**Files:**
- Verify docs and existing command gates.
- Commit tracked documentation updates only.

- [ ] **Step 1: Run fixture replay gates**

Run:

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Expected:

```text
trace:fixtures exits 0 with ok=true, total=2, passed=2, failed=0.
trace:fixtures:summary exits 0 and prints Status: OK.
```

- [ ] **Step 2: Run full regression gates**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

```text
All commands exit 0. Lint/build may still show the existing <img> warning in src/__tests__/components/ShellUI.test.tsx.
```

- [ ] **Step 3: Commit docs completion**

Stage only:

```bash
git add docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-trace-governance-operational-runbook.md
```

Commit:

```bash
git commit -m "docs: add trace governance operational runbook"
```

Do not stage unrelated local files or `memory/2026-07-06.md`.

## Self-Review

- Spec coverage: This plan implements the runbook, cross-links, project record updates, local memory update, verification, and focused commit.
- Completeness scan: No unfinished markers remain; all paths, snippets, commands, and expected outputs are explicit.
- Type consistency: Command names match `package.json`; document names match existing governed trace docs.
