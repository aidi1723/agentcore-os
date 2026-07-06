# Fixture Replay CI Gate Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document how governed trace fixture replay commands should be used in local, fixture-refresh, and CI-style gates.

**Architecture:** This is a docs-only trace governance phase. A new CI/local gate guide owns command role guidance, while the replay contract keeps failure interpretation and the refresh workflow keeps candidate replacement review.

**Tech Stack:** Markdown documentation, existing `npm run trace:*` commands, existing controlled runtime verification commands.

---

## File Structure

- Create: `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
  - New command usage and CI-style gate guide.
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
  - Link to the CI gate guide from maintainer command sequence/source context.
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
  - Link to CI gate guide from verification sections.
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - Add the new guide to internal engineering documents.
- Modify: `CHANGELOG.md`
  - Record Phase 10s documentation.
- Modify: `docs/NEXT_STEPS.md`
  - Mark Phase 10s complete and set next phase.
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Add Phase 10s progress and update next phase.
- Modify: `memory/2026-07-06.md`
  - Record local continuity only; do not stage.

## Task 1: Add CI Gate Guide

**Files:**
- Create: `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`

- [x] **Step 1: Add purpose and boundaries**

Create:

```markdown
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
```

- [x] **Step 2: Add command roles**

Add:

```markdown
## 3. Command Roles

| Command | Primary use | Output contract | Automation status |
| --- | --- | --- | --- |
| `npm run trace:fixtures --silent` | CI-style and scriptable fixture health gate | Stable JSON report with `ok`, counts, ids, failed items, diagnostics, and no-side-effect guarantees | Use for automation |
| `npm run trace:fixtures:summary --silent` | Local human triage and review | Human-readable summary over the same report | Do not parse in automation |
| `npm run trace:fixture:build -- <artifact.json>` | Manual candidate fixture generation from a governed artifact | Fixture JSON on stdout or stable stderr diagnostics on failure | Use only in refresh workflow |

Automation should consume only `trace:fixtures` JSON. Summary text can change for readability.
```

- [x] **Step 3: Add local and refresh gates**

Add:

```markdown
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
```

- [x] **Step 4: Add CI-style gate, failure path, and output stability**

Add:

```markdown
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
```

## Task 2: Link Existing Docs

**Files:**
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`

- [x] **Step 1: Link from replay contract**

Add near the purpose/source context:

```markdown
For local and CI-style command usage, see [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md).
```

- [x] **Step 2: Link from refresh workflow**

Add near verification sections:

```markdown
For local and CI-style gate policy, see [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md).
```

- [x] **Step 3: Link from documentation index**

Add under internal engineering:

```markdown
- [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)
```

## Task 3: Align Project Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Update changelog**

Add:

```markdown
### Fixture Replay CI Gate Documentation

- Added a governed trace fixture CI gate guide documenting command roles for `trace:fixtures`, `trace:fixtures:summary`, and `trace:fixture:build`.
- Clarified that automation should consume stable JSON from `trace:fixtures`, while summary output remains human-readable triage.
- Documented local development, fixture refresh, and CI-style gate sequences without adding new CI automation.
```

- [x] **Step 2: Update next steps**

Add completed Phase 10s and set next phase:

```markdown
## Recommended Next. Fixture Replay Catalog Expansion Review
```

Scope:

```markdown
- Review whether additional controlled playbooks or edge-case governed traces need committed fixtures.
- Keep expansion review documentation-first unless a real missing fixture is identified.
```

- [x] **Step 3: Update controlled runtime manual**

Add progress:

```markdown
- Phase 10s fixture replay CI gate documentation：已新增 governed trace fixture CI gate guide，明确 `trace:fixtures` 是自动化 JSON contract，`trace:fixtures:summary` 是人读 triage，`trace:fixture:build` 只属于人工 refresh workflow。
```

Set next phase to:

```markdown
Phase 10t. Fixture Replay Catalog Expansion Review
```

- [x] **Step 4: Update local memory**

Append:

```markdown
## Fixture Replay CI Gate Documentation completed

- Implemented Phase 10s docs-only trace governance hardening.
- Added `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`.
- Linked replay contract, refresh workflow, documentation index, changelog, next steps, and controlled runtime manual.
- Final verification commands and completion commit should be recorded after verification.
```

Do not stage `memory/2026-07-06.md`.

## Task 4: Verify And Commit

**Files:**
- Verify docs and existing gates.
- Commit tracked documentation updates only.

- [x] **Step 1: Run fixture replay gates**

Run:

```bash
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Expected:

```text
trace:fixtures reports ok=true, total=2, passed=2, failed=0.
trace:fixtures:summary prints Status: OK.
```

- [x] **Step 2: Run full regression gates**

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

- [x] **Step 3: Commit docs completion**

Stage only:

```bash
git add docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-fixture-replay-ci-gate-documentation.md
```

Commit:

```bash
git commit -m "docs: document fixture replay ci gates"
```

Do not stage unrelated local files or `memory/2026-07-06.md`.
