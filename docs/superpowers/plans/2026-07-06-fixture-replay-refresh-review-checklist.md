# Fixture Replay Refresh Review Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concrete candidate fixture review checklist to the governed trace fixture refresh workflow and align project records around the new maintenance path.

**Architecture:** This is a docs-only trace governance phase. The refresh guide owns the maintainer checklist, while the replay contract remains the diagnostic interpretation source for failed validation/replay output.

**Tech Stack:** Markdown documentation, existing governed trace fixture commands, existing Vitest/npm verification commands.

---

## File Structure

- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
  - Replace the loose candidate review bullet list with a structured pass/fail checklist.
  - Cross-link rejection triage to the replay contract failure fixture matrix.
- Modify: `CHANGELOG.md`
  - Record Phase 10r as a documentation and maintenance-path update.
- Modify: `docs/NEXT_STEPS.md`
  - Mark the refresh review checklist complete and point the next recommended phase beyond it.
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Add the Phase 10r progress note and update the next phase.
- Modify: `memory/2026-07-06.md`
  - Record local continuity; do not stage this file.

## Task 1: Add Candidate Review Checklist

**Files:**
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`

- [ ] **Step 1: Replace the loose review section with a checklist introduction**

Replace the current `## 5. Review Candidate Fixture` body with:

```markdown
Before replacing a committed fixture file, inspect `/tmp/governed-trace-fixture.json` with the checklist below.

Every check is a gate. If a candidate fails a gate, reject the candidate and fix the governed artifact source or playbook contract. Do not hand-edit generated fixture JSON to hide a failure.

Use [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md#6-failure-fixture-matrix) to classify validation failures, replay drift, summary diagnostics, and harness behavior.
```

- [ ] **Step 2: Add source identity and redaction gates**

Add:

```markdown
### 5.1 Source Identity Gate

Pass:

- `schemaVersion` is `controlled-trace-fixture/v1`.
- `sourceRunId` is present and stable.
- `fixtureId` names the intended maintained fixture.
- `playbookId` and `scenarioId` match the intended controlled playbook.

Reject:

- `sourceRunId` is missing.
- The candidate points at the wrong playbook or scenario.
- The source run identity is ambiguous.

### 5.2 Redaction Gate

Pass:

- each step has `hasRedactedInput: true`;
- each step has `hasRedactedOutput: true`;
- each tool call has `outputRedacted: true`;
- serialized fixture JSON contains no raw customer names, emails, secrets, API keys, prompt text, or tool output payloads.

Reject:

- any redaction flag is false or missing;
- known raw payload markers appear in the candidate;
- the maintainer would need to manually remove raw content from generated JSON.
```

- [ ] **Step 3: Add playbook, approval, and writeback gates**

Add:

```markdown
### 5.3 Playbook Contract Gate

Pass:

- `playbookVersion` is the intended current version.
- `assertions.stepOrder` matches the current playbook step order.
- `plan.id`, `plan.totalSteps`, `plan.requiresApproval`, and `plan.stepOrder` match the current playbook.

Reject:

- the candidate reflects an unreviewed playbook migration;
- the candidate step order differs from the current playbook;
- plan metadata drift is unexplained.

### 5.4 Approval And Terminal-State Gate

Pass:

- each approval-gated step has `approvalState`;
- completed approval-gated steps have `approvalState: "approved"`;
- completed steps have `attempts >= 1`.

Reject:

- approval metadata is missing;
- a completed approval-gated step is not approved;
- a completed step has no recorded attempt.

### 5.5 Writeback Identity Gate

Pass:

- each playbook writeback target appears on the same fixture step;
- successful writeback targets include stable `target`, `assetId`, `sourceKey`, and `workflowRunId` where applicable;
- skipped or failed writeback targets preserve their explicit status instead of being rewritten as success.

Reject:

- successful writeback metadata cannot identify the retained asset;
- writeback targets are missing after an intentional playbook contract change;
- a candidate needs manual receipt edits to look stable.
```

- [ ] **Step 4: Add command, diff, and sensitive search gates**

Add:

```markdown
### 5.6 Failure Triage Gate

Before replacement, run the catalog commands against the committed catalog and classify failures:

```bash
npm run trace:fixtures:summary --silent
npm run trace:fixtures --silent
```

If either command fails, use the replay contract failure fixture matrix before replacing anything:

- validation failure means reject the candidate or fix governed artifact redaction/source identity;
- replay drift means confirm the playbook contract before refreshing;
- missing stable writeback metadata means fix receipt source or re-export;
- harness behavior failures belong in tests, not committed catalog fixtures.

### 5.7 Sensitive String Search Gate

Run:

```bash
rg "sk-|api[_-]?key|secret|password|token|@|Nora|raw" /tmp/governed-trace-fixture.json
```

Adjust the terms for known sensitive strings in the source run. Any match must be explained as safe metadata or the candidate is rejected.

### 5.8 Replacement Diff Gate

After manual replacement and before commit, inspect:

```bash
git diff -- src/__tests__/fixtures/controlled-traces/
```

Pass only when the diff changes governed fixture metadata for the intended fixture and introduces no raw payloads, unrelated fixture edits, temporary files, or synthetic failure entries.
```

## Task 2: Align Project Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update changelog**

Add:

```markdown
### Fixture Replay Refresh Review Checklist

- Added a pass/fail candidate fixture review checklist to the governed trace fixture refresh workflow.
- Split refresh review into source identity, redaction, playbook contract, approval state, writeback identity, failure triage, sensitive search, and replacement diff gates.
- Cross-linked candidate failure triage to the replay contract failure fixture matrix.
```

- [ ] **Step 2: Update next steps**

Mark the checklist phase complete and set:

```markdown
## Recommended Next. Fixture Replay CI Gate Documentation
```

with scope:

```markdown
- Document how `npm run trace:fixtures --silent` and `npm run trace:fixtures:summary --silent` should be used in local and CI-style gates.
- Keep CI gate work documentation-first unless a missing script or package command is discovered.
```

- [ ] **Step 3: Update development manual**

Add Phase 10r progress:

```markdown
- Phase 10r fixture replay refresh review checklist：已把 governed fixture refresh 的候选 fixture 审查拆成 source identity、redaction、playbook contract、approval、writeback identity、failure triage、sensitive search 和 replacement diff gates。失败分类链接到 replay contract failure fixture matrix。
```

Set next phase to:

```markdown
Phase 10s. Fixture Replay CI Gate Documentation
```

- [ ] **Step 4: Update local memory**

Append:

```markdown
## Fixture Replay Refresh Review Checklist completed

- Implemented Phase 10r docs-only trace governance hardening.
- Added candidate fixture review gates to the governed fixture refresh workflow.
- Aligned changelog, next steps, and controlled runtime manual.
- Final verification commands and completion commit should be recorded after verification.
```

Do not stage `memory/2026-07-06.md`.

## Task 3: Verify And Commit

**Files:**
- Verify docs and existing command gates.
- Commit tracked documentation updates only.

- [ ] **Step 1: Run fixture replay checks**

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
git add docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-fixture-replay-refresh-review-checklist.md
```

Commit:

```bash
git commit -m "docs: add fixture refresh review checklist"
```

Do not stage unrelated local files or `memory/2026-07-06.md`.
