# Fixture Replay Failure Documentation Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a maintainer-facing failure fixture matrix for governed trace fixture replay and align the project records around it.

**Architecture:** This is a docs-only maintenance phase. The replay contract guide becomes the source of truth for mapping failure diagnostics to synthetic factories, regression owners, and maintainer actions; existing tests remain the executable proof.

**Tech Stack:** Markdown documentation, existing Vitest coverage, existing npm replay/test/lint/build commands.

---

## File Structure

- Modify: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
  - Add the `Failure Fixture Matrix` section after diagnostics/triage context.
  - Map validation failures, replay drift failures, summary failures, and process exit harness coverage to concrete source files.
- Modify: `CHANGELOG.md`
  - Record Phase 10q as a documentation and maintenance-path update.
- Modify: `docs/NEXT_STEPS.md`
  - Mark the failure documentation matrix complete and point the next phase beyond it.
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Add the new fixture replay maintenance practice to the Trace Governance section.
- Modify: `memory/2026-07-06.md`
  - Record the phase result locally without staging the local memory file.

## Task 1: Add Replay Contract Failure Matrix

**Files:**
- Modify: `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`

- [ ] **Step 1: Insert a new `Failure Fixture Matrix` section**

Add a section after `## 5. Diagnostics Reference` and before `## 6. Failure Triage`.

The section must state:

```markdown
## 6. Failure Fixture Matrix

这些 synthetic failures 只存在于测试目录，用来证明 replay/summary/harness 的失败诊断稳定。它们不是 committed governed fixture，不能加入 `controlledTraceFixtureCatalog` 的正常 catalog。
```

- [ ] **Step 2: Add the validation failure rows**

Add rows for:

```markdown
| Validation: missing source run id | `buildMissingSourceRunIdCatalogEntry()` in `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts` | `Fixture sourceRunId is required` | `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` | Reject the candidate artifact source; regenerate from a governed trace with stable source identity. |
| Validation: unredacted step input | `buildUnredactedInputCatalogEntry()` in `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts` | `Step intake input is not redacted` | `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` | Reject the candidate; fix governed artifact redaction before fixture refresh. |
| Validation: unredacted tool output | `buildUnredactedToolOutputCatalogEntry()` in `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts` | `Step intake tool llm_generate output is not redacted` | `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` | Reject the candidate; do not hand-edit raw output out of a fixture. |
| Validation summary bundle | `buildCombinedValidationFailureCatalogEntry()` in `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts` | Summary line contains all validation errors | `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts` | Use summary output for local triage, then inspect `failedItems[].validationErrors` if machine-readable detail is needed. |
```

- [ ] **Step 3: Add the replay drift and harness rows**

Add rows for:

```markdown
| Replay drift: playbook version | `buildPlaybookVersionDriftCatalogEntry()` in `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts` | `Fixture playbook version does not match current playbook sales-pipeline-v1`; diagnostics include expected/fixture versions | `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` | Confirm whether playbook migration is intentional; refresh fixture only after playbook tests prove the new contract. |
| Replay drift: missing stable writeback metadata | `buildMissingStableMetadataCatalogEntry()` in `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts` | `Step writeback writeback target sales_asset is missing stable metadata sourceKey`; diagnostics include `writebackTargetsMissingStableMetadata` | `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts` | Fix receipt source or re-export from a run with stable `assetId`, `sourceKey`, and `workflowRunId`. |
| Combined summary drift | `buildCombinedSummaryFailureCatalogEntry()` in `src/__tests__/fixtures/controlled-traces/synthetic-failures.ts` | Human summary renders version drift plus missing stable metadata diagnostics | `src/__tests__/scripts/trace-fixture-catalog-summary-script.test.ts` | Start from `npm run trace:fixtures:summary --silent`; switch to JSON report for CI/debug tooling. |
| Process exit harness | `scripts/trace-fixtures/catalog-failure-harness.mjs --format json|summary` | Synthetic failed catalogs exit `1`; committed catalog commands remain green | `src/__tests__/scripts/trace-fixture-catalog-failure-harness-script.test.ts` | Use only for regression tests and local harness checks; do not wire synthetic failures into the normal committed catalog command. |
```

- [ ] **Step 4: Renumber following headings**

Because the new section is inserted before triage, update later headings from:

```markdown
## 6. Failure Triage
## 7. Maintainer Command Sequence
## 8. What This Does Not Prove
```

to:

```markdown
## 7. Failure Triage
## 8. Maintainer Command Sequence
## 9. What This Does Not Prove
```

## Task 2: Align Project Records

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Update changelog**

Add an entry describing:

```markdown
- Added Phase 10q failure fixture matrix to the governed trace replay contract, mapping validation failures, replay drift failures, summary diagnostics, and the process exit harness to their source factories/tests and maintainer actions.
```

- [ ] **Step 2: Update next steps**

Mark Phase 10q complete and set the next recommended phase to the next trace governance hardening slice. Use this wording:

```markdown
Next recommended phase: Fixture Replay Refresh Review Checklist.
```

- [ ] **Step 3: Update development manual**

Add the maintenance rule:

```markdown
When fixture replay fails, first classify the failure through `docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md#6-failure-fixture-matrix`; only refresh fixtures after confirming whether the failure is validation, replay drift, summary rendering, or harness exit behavior.
```

- [ ] **Step 4: Update local memory**

Append a local record to `memory/2026-07-06.md` with:

```markdown
## Fixture replay failure documentation matrix completed

- Implemented Phase 10q docs-only trace governance hardening.
- Added a failure fixture matrix to the replay contract guide.
- Aligned changelog, next steps, and controlled runtime development manual.
- Final verification commands and commit ids should be recorded after verification.
```

Do not stage `memory/2026-07-06.md` unless project policy changes.

## Task 3: Verify And Commit

**Files:**
- Verify docs and test commands only.
- Commit tracked documentation updates.

- [ ] **Step 1: Run replay commands**

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

- [ ] **Step 2: Run regression commands**

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
git add docs/GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-fixture-replay-failure-documentation-matrix.md
```

Commit:

```bash
git commit -m "docs: map fixture replay failure diagnostics"
```

Do not stage unrelated local files or `memory/2026-07-06.md`.
