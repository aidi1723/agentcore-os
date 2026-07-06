# Fixture Replay Contract Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a maintainer-facing replay contract guide that explains governed fixture replay invariants, diagnostics, and failure triage.

**Architecture:** Keep this as a documentation-only phase. The new guide documents the current `trace-fixtures.ts` and `trace-replay.ts` behavior, then existing docs link to it from the fixture refresh workflow, documentation index, manual, backlog, and changelog.

**Tech Stack:** Markdown documentation, existing TypeScript replay source as the contract source of truth, existing npm verification commands.

---

## File Structure

- Create `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`: the main replay contract matrix and triage guide.
- Modify `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`: link the contract guide from candidate review and drift diagnosis sections.
- Modify `docs/DOCUMENTATION_INDEX.zh-CN.md`: list the contract guide next to the refresh guide.
- Modify `docs/NEXT_STEPS.md`: mark Phase 10l completed and set Phase 10m as recommended next.
- Modify `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: record Phase 10l and next phase.
- Modify `CHANGELOG.md`: add an Unreleased entry.
- Modify `memory/2026-07-06.md`: append local phase record. This file may be untracked and should not be force-added if it remains untracked.

## Task 1: Add Replay Contract Guide

**Files:**
- Create: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`

- [ ] **Step 1: Create the guide skeleton**

Create the file with these sections:

```md
# Governed Trace Fixture Replay Contract

Last updated: 2026-07-06

## 1. Purpose
## 2. Hard Boundaries
## 3. Source Of Truth
## 4. Replay Invariant Matrix
## 5. Diagnostics Reference
## 6. Failure Triage
## 7. Maintainer Command Sequence
## 8. What This Does Not Prove
```

- [ ] **Step 2: Write purpose and boundaries**

State that the guide explains `npm run trace:fixtures --silent` replay failures for committed governed fixtures. Include this boundary list:

```md
- no LLM replay;
- no tool execution or simulation;
- no API route calls;
- no runtime store reads or writes;
- no asset writes;
- no automatic fixture discovery;
- no automatic committed fixture refresh.
```

- [ ] **Step 3: Write source-of-truth hierarchy**

Add a compact list:

```md
1. `validateControlledTraceFixture()` checks fixture schema, redaction, and fixture self-consistency.
2. `getControlledPlaybook()` provides the current playbook source of truth.
3. `replayControlledTraceFixture()` compares committed fixture metadata to the current playbook.
4. `buildControlledTraceFixtureCatalogReport()` aggregates validation and replay results for the explicit catalog.
5. `scripts/trace-fixtures/catalog-report.mjs` prints the machine-readable local summary.
```

- [ ] **Step 4: Add replay invariant matrix**

Add a Markdown table with columns:

```md
| Area | Checked fields | Source of truth | Failure means | Maintainer action |
```

Include rows for:

- Fixture schema and identity.
- Redaction boundary.
- Registered playbook.
- Playbook version and scenario.
- Step order.
- Plan metadata.
- Approval state presence.
- Approval terminal state.
- Required writeback targets.
- Stable writeback metadata.
- Completed attempts.
- No-side-effect guarantees.

- [ ] **Step 5: Add diagnostics reference**

Add a table with columns:

```md
| Diagnostic field | Meaning | First action |
```

Include every current field from `ControlledTraceReplayDiagnostics`.

- [ ] **Step 6: Add failure triage**

Add four subsections:

```md
### Playbook Drift
### Stale Fixture
### Bad Governed Artifact Source
### Unsafe Candidate Fixture
```

Each subsection should state how to identify it and what to do next.

- [ ] **Step 7: Add command sequence and limitations**

Include:

```bash
npm run trace:fixtures --silent
npm run trace:fixture:build -- /tmp/governed-trace-artifact.json > /tmp/governed-trace-fixture.json
npm run test:controlled-runtime
```

Clarify that green replay proves metadata compatibility, not semantic equivalence to the original run output.

- [ ] **Step 8: Review the guide against source**

Run:

```bash
rg "expectedPlaybookVersion|fixturePlaybookVersion|expectedScenarioId|fixtureScenarioId|expectedPlanId|fixturePlanId|expectedPlanTotalSteps|fixturePlanTotalSteps|expectedPlanRequiresApproval|fixturePlanRequiresApproval|planStepOrder|missingCompletedStepAttempts|nonApprovedApprovalStepIds|writebackTargetsMissingStableMetadata" docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md src/lib/executor/runtime/trace-replay.ts
```

Expected: all diagnostic fields appear in the guide and source.

## Task 2: Link The Contract Guide

**Files:**
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`

- [ ] **Step 1: Link from refresh guide purpose**

In `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`, add after the purpose paragraph:

```md
If `npm run trace:fixtures --silent` fails, first read [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md) to identify whether the failure is playbook drift, stale fixture metadata, or an unsafe candidate fixture.
```

- [ ] **Step 2: Link before candidate checklist**

In section 5, add:

```md
Use the replay contract matrix as the interpretation layer for every failed `failedItems[].diagnostics` field.
```

- [ ] **Step 3: Link from failed catalog health section**

In section 7, replace the generic failure sentence with:

```md
If this fails, inspect `failedItems[].replayErrors` and `failedItems[].diagnostics`, then use the replay contract guide to decide whether to update the playbook, refresh the fixture, or reject the artifact source.
```

- [ ] **Step 4: Add documentation index entry**

Add:

```md
- [Governed Trace Fixture Replay Contract](GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md)
```

next to the refresh workflow in `docs/DOCUMENTATION_INDEX.zh-CN.md`.

## Task 3: Update Phase Docs

**Files:**
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update Next Steps**

Add the contract guide to the completed baseline. Replace `Recommended Next. Fixture Replay Contract Documentation` with:

```md
## Completed. Fixture Replay Contract Documentation

Delivered:

- Added `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`.
- Documented the replay invariant matrix for fixture schema, redaction, playbook registration, version/scenario, step order, plan metadata, approvals, writeback targets, stable writeback metadata, completed attempts, and no-side-effect guarantees.
- Added a diagnostics reference for every current `ControlledTraceReplayDiagnostics` field.
- Added failure triage for playbook drift, stale fixtures, bad governed artifact source, and unsafe candidate fixtures.
- Linked the guide from the governed fixture refresh workflow and documentation index.

## Recommended Next. Fixture Replay Error Summary CLI
```

For the next phase suggested scope, state:

```md
- Keep `trace:fixtures` as the machine-readable JSON command.
- Add a separate local command that prints a human-readable failure summary from the same catalog report.
- Do not discover fixtures automatically, refresh fixtures, call routes, replay tools, mutate stores, or write assets.
```

- [ ] **Step 2: Update controlled runtime manual**

Add:

```md
- Phase 10l fixture replay contract documentation：已新增 governed replay contract guide，把 replay invariant matrix、diagnostics fields 和 failure triage 文档化，并从 fixture refresh workflow 链接过去。
```

Set next default to `Phase 10m. Fixture Replay Error Summary CLI`.

- [ ] **Step 3: Update changelog**

Add:

```md
### Fixture Replay Contract Documentation

- Added a governed trace fixture replay contract guide covering invariant checks, diagnostics, failure triage, and maintainer commands for fixture refresh review.
```

## Task 4: Update Local Record

**Files:**
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Append Phase 10l local record**

Add a section:

```md
## Fixture Replay Contract Documentation completed

- Implemented Phase 10l: Fixture Replay Contract Documentation.
- Added `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`.
- Linked the guide from refresh workflow, documentation index, Next Steps, and controlled runtime manual.
- Final verification:
  - `npm run trace:fixtures --silent`
  - `npm run test:controlled-runtime`
  - `npm run test:core-workflows`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Next recommended phase: Fixture Replay Error Summary CLI.
```

- [ ] **Step 2: Do not force-add untracked memory**

Run:

```bash
git ls-files memory/2026-07-06.md
```

Expected: if empty, keep it out of the commit.

## Task 5: Verification And Commit

**Files:**
- No edits unless verification exposes a docs defect.

- [ ] **Step 1: Search docs links and fields**

Run:

```bash
rg "Governed Trace Fixture Replay Contract|Fixture Replay Error Summary CLI|Phase 10l|Phase 10m|writebackTargetsMissingStableMetadata" docs CHANGELOG.md
```

Expected: finds the new guide, links, completed phase, next phase, and diagnostic field.

- [ ] **Step 2: Run fixture summary**

```bash
npm run trace:fixtures --silent
```

Expected: exit 0, `ok: true`, `total: 2`, `failed: 0`.

- [ ] **Step 3: Run controlled runtime suite**

```bash
npm run test:controlled-runtime
```

Expected: all tests pass.

- [ ] **Step 4: Run core workflow suite**

```bash
npm run test:core-workflows
```

Expected: all regressions pass.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: exit 0. Existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` may still appear.

- [ ] **Step 6: Run build**

```bash
npm run build
```

Expected: exit 0. Same existing warning may still appear.

- [ ] **Step 7: Run whitespace check**

```bash
git diff --check
```

Expected: exit 0.

- [ ] **Step 8: Commit tracked docs**

```bash
git add docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md CHANGELOG.md
git commit -m "docs: add fixture replay contract guide"
```

## Rollback Checkpoint

- Starting checkpoint before implementation: `67e33b5 docs: spec fixture replay contract documentation`.
- Roll back this phase by reverting commits created after that checkpoint.
- No runtime stores, generated assets, browser sessions, external publishing, migrations, or code behavior changes are part of this phase.
