# Fixture Replay Catalog Expansion Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed fixture catalog coverage review guide and align project records around when to expand the committed fixture catalog.

**Architecture:** This is a docs-only trace governance phase. The new coverage guide owns the committed catalog matrix and expansion rules; replay contract and CI gate docs link to it without changing replay implementation or fixture JSON.

**Tech Stack:** Markdown documentation, existing governed trace fixture catalog, existing npm verification commands.

---

## File Structure

- Create: `docs/GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md`
  - Document current committed fixture coverage and expansion decision rules.
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
  - Link the catalog coverage guide from the purpose/source-of-truth sections.
- Modify: `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
  - Link the catalog coverage guide from command role and gate interpretation sections.
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - Add the coverage guide to internal engineering docs.
- Modify: `CHANGELOG.md`
  - Record Phase 10t.
- Modify: `docs/NEXT_STEPS.md`
  - Mark Phase 10t complete and recommend the next phase.
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Add Phase 10t progress and next direction.
- Modify: `docs/superpowers/plans/2026-07-06-fixture-replay-catalog-expansion-review.md`
  - Check off steps and record verification evidence.
- Modify: `memory/2026-07-06.md`
  - Record local continuity; do not stage this file.

## Task 1: Add Catalog Coverage Guide

**Files:**
- Create: `docs/GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md`

- [x] **Step 1: Write purpose and boundaries**

Create the guide with:

```markdown
# Governed Trace Fixture Catalog Coverage

Last updated: 2026-07-06

## 1. Purpose

This guide records what the committed governed trace fixture catalog currently covers and when maintainers should add another committed fixture.

Use it with:

- [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md)
- [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)
- [Governed Trace Fixture CI Gates](GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md)

## 2. Hard Boundaries

Catalog coverage review is a maintenance decision layer only:

- no LLM replay;
- no tool execution;
- no API route calls;
- no runtime store reads or writes;
- no asset writes;
- no automatic fixture discovery;
- no automatic fixture refresh;
- no promotion of synthetic failure fixtures into the committed catalog.
```

- [x] **Step 2: Add source-of-truth and coverage matrix**

Add:

```markdown
## 3. Current Catalog Source Of Truth

Committed governed fixtures are explicitly listed in `src/__tests__/fixtures/controlled-traces/catalog.ts`.

Current entries:

| Catalog id | Fixture file | Playbook | Scenario | Terminal state | Decision |
| --- | --- | --- | --- | --- | --- |
| `sales-pipeline-governed` | `sales-pipeline-governed.fixture.json` | `sales-pipeline-v1` | `sales-pipeline` | `completed` | Keep as the sales happy-path contract fixture. |
| `support-resolution-governed` | `support-resolution-governed.fixture.json` | `support-resolution-v1` | `support-ops` | `completed` | Keep as the support happy-path contract fixture. |

## 4. Coverage Matrix

| Dimension | Current coverage | Evidence | Gap decision |
| --- | --- | --- | --- |
| Registered playbooks | Both current playbooks have one committed fixture. | `sales-pipeline-v1`, `support-resolution-v1` | No new fixture until a new playbook is registered. |
| Terminal state | Both committed fixtures are `completed`. | Fixture `terminalState` fields | Do not add rejected/failed/awaiting fixtures until replay defines stable terminal-state contracts for them. |
| Approval behavior | Both fixtures include approved `human_review` and `writeback` approval gates. | `approvalState: "approved"` on approval-gated steps | Rejection and pending approval remain runtime behavior tests, not committed governed fixtures yet. |
| Writeback target families | Sales covers `sales_asset`, `knowledge_asset`, `draft`, `workflow_run`; support covers `support_asset`, `knowledge_asset`, `draft`, `workflow_run`. | Fixture `writebackTargets` | Add a fixture only when a new durable target family appears and is not covered by sales/support. |
| Stable metadata | Successful writeback targets carry `assetId`, `sourceKey`, and `workflowRunId`. | Fixture writeback target metadata | Missing metadata is covered by synthetic failure fixtures, not another committed happy-path fixture. |
| Redaction boundary | Both fixtures mark step input/output and tool output redacted. | `hasRedactedInput`, `hasRedactedOutput`, `outputRedacted` | Unsafe candidates are rejected through refresh review. |
| Edge-case drift | Version drift, missing metadata, missing source id, unredacted input/output, summary failure, and exit-code failure are covered synthetically. | `synthetic-failures.ts` and catalog tests | Keep edge cases synthetic unless they become durable product examples. |
```

- [x] **Step 3: Add expansion rules and next recommendation**

Add:

```markdown
## 5. When To Add A Committed Fixture

Add a new committed governed fixture only when at least one condition is true:

- a new registered controlled playbook needs baseline replay coverage;
- a new durable writeback target family cannot be represented by existing sales/support fixtures;
- replay grows a stable terminal-state contract for failed, rejected, or awaiting states;
- a real governed artifact reveals a contract gap that synthetic failure fixtures cannot represent;
- the fixture will become a long-lived compatibility contract, not a one-off scenario sample.

Do not add a committed fixture for:

- minor copy or content variation;
- another example of the same completed approval path;
- raw failure examples that are better represented by synthetic failure factories;
- temporary local debugging artifacts;
- candidate fixtures that need manual redaction or manual receipt edits.

## 6. Current Decision

No new committed fixture is needed in Phase 10t.

The current catalog already covers every registered playbook, the primary completed terminal state, approval-approved paths, all current writeback target families, redaction metadata, and stable record identity metadata.

The next recommended phase should move from fixture catalog maintenance to trace governance operationalization, such as real replay boundaries, governed artifact lifecycle policy, or operator-facing trace governance runbooks.
```

## Task 2: Cross-Link Guide

**Files:**
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
- Modify: `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`

- [x] **Step 1: Link from replay contract**

In `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`, add a sentence near the purpose:

```markdown
For catalog coverage and expansion decisions, see [Governed Trace Fixture Catalog Coverage](GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md).
```

- [x] **Step 2: Link from CI gate guide**

In `docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`, add the guide to the "Use this guide with" list:

```markdown
- [Governed Trace Fixture Catalog Coverage](GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md)
```

- [x] **Step 3: Link from documentation index**

In `docs/DOCUMENTATION_INDEX.zh-CN.md`, add:

```markdown
- [Governed Trace Fixture Catalog Coverage](GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md)
```

beside the other governed trace fixture docs.

## Task 3: Align Project Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Update changelog**

Add under `## Unreleased`:

```markdown
### Fixture Replay Catalog Expansion Review

- Added a governed trace fixture catalog coverage guide documenting current sales/support fixture coverage.
- Recorded the decision that no new committed fixture is needed while sales and support cover all registered playbooks and current writeback target families.
- Added expansion rules for future fixtures based on new playbooks, durable writeback target families, stable terminal-state contracts, or real contract gaps.
```

- [x] **Step 2: Update Next Steps**

Add the coverage guide to the completed baseline and add a completed section:

```markdown
## Completed. Fixture Replay Catalog Expansion Review

Why:

- The committed fixture catalog now covers sales and support, but maintainers needed a rule for when to add more fixture JSON.
- More fixtures are useful only when they preserve durable contract coverage, not when they duplicate scenario variety.

Delivered:

- Added `docs/GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md`.
- Reviewed coverage by playbook, terminal state, approval behavior, writeback target family, stable metadata, and edge-case traces.
- Documented that no new committed fixture is needed in Phase 10t.
- Defined future expansion triggers.

Outcome:

- The fixture catalog has a controlled maintenance path.
- Future fixture additions require a durable contract reason.

## Recommended Next. Trace Governance Operational Runbook
```

Set the recommended next scope to documentation/operations around governed trace artifact lifecycle and real replay boundaries.

- [x] **Step 3: Update development manual**

Add Phase 10t progress:

```markdown
- Phase 10t fixture replay catalog expansion review：已新增 catalog coverage guide，确认当前 sales/support completed fixtures 覆盖所有注册 playbook、当前 writeback target family、approved approval path、redaction metadata 和 stable writeback identity；本阶段不新增 fixture JSON。
```

Set the next phase to:

```markdown
Phase 10u. Trace Governance Operational Runbook
```

- [x] **Step 4: Update local memory**

Append:

```markdown
## Fixture Replay Catalog Expansion Review completed

- Implemented Phase 10t docs-only governance review.
- Added catalog coverage guide and expansion decision rules.
- Decision: do not add new committed fixture JSON in Phase 10t.
- Next recommended phase: Trace Governance Operational Runbook.
```

Do not stage `memory/2026-07-06.md`.

## Task 4: Verify And Commit

**Files:**
- Verify docs and existing command gates.
- Commit tracked documentation updates only.

- [x] **Step 1: Run fixture replay gates**

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

Observed:

```text
trace:fixtures exited 0 with ok=true, total=2, passed=2, failed=0.
trace:fixtures:summary exited 0 with Status: OK.
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

Observed:

```text
npm run test:controlled-runtime: 30 files, 166 tests passed.
npm run test:core-workflows: all core workflow regressions passed.
npm run lint: exit 0 with existing <img> warning in src/__tests__/components/ShellUI.test.tsx.
npm run build: exit 0 with the same existing warning.
git diff --check: exit 0.
```

- [x] **Step 3: Commit docs completion**

Stage only:

```bash
git add docs/GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-fixture-replay-catalog-expansion-review.md
```

Commit:

```bash
git commit -m "docs: review fixture catalog expansion"
```

Do not stage unrelated local files or `memory/2026-07-06.md`.

## Self-Review

- Spec coverage: This plan implements the requested catalog coverage guide, cross-links, project record alignment, local memory record, verification, and focused commit.
- Completeness scan: No unfinished markers remain; all paths, snippets, commands, and expected outputs are explicit.
- Type consistency: Documentation names match existing governed trace fixture docs and package command names.
