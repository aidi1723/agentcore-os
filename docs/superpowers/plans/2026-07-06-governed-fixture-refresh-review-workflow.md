# Governed Fixture Refresh Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a maintainer-facing governed fixture refresh workflow so stale committed fixtures can be replaced manually and safely.

**Architecture:** This is a documentation-only slice. Add one focused guide under `docs/`, link it from the controlled runtime manual and documentation index, update Next Steps and changelog, and keep all fixture replacement manual with existing builder/catalog commands.

**Tech Stack:** Markdown documentation, existing npm scripts `trace:fixture:build`, `trace:fixtures`, `test:controlled-runtime`, existing governed trace fixture catalog.

---

## File Structure

- Create `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`: maintainer workflow guide.
- Modify `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: link guide, mark Phase 10j complete, set next phase.
- Modify `docs/NEXT_STEPS.md`: baseline and completed/recommended-next updates.
- Modify `docs/DOCUMENTATION_INDEX.zh-CN.md`: add guide to doc index.
- Modify `CHANGELOG.md`: record the workflow guide.
- Modify `memory/2026-07-06.md`: local record after verification.

---

### Task 1: Fixture Refresh Guide

**Files:**
- Create: `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`

- [x] **Step 1: Create the maintainer guide**

Create `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md` with:

```markdown
# Governed Trace Fixture Refresh Workflow

Last updated: 2026-07-06

## 1. Purpose

This guide is the manual refresh path for committed governed trace fixtures.

Use it when a controlled playbook changes and `npm run trace:fixtures --silent` shows fixture drift, or when a known-good governed trace artifact should replace a stale fixture.

This workflow is intentionally manual. The builder command prints fixture JSON to stdout. A maintainer reviews the generated JSON and decides whether to replace a committed fixture file.

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

If this fails, inspect `failedItems[].diagnostics` before editing playbooks or fixtures again.

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
```

- [x] **Step 2: Inspect the guide**

Run:

```bash
sed -n '1,260p' docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md
```

Expected: the guide contains purpose, boundaries, command recipe, review checklist, verification gates, diff review, and commit guidance.

---

### Task 2: Documentation Links And Phase Status

**Files:**
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Update controlled runtime manual**

Modify `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`:

- Add `[Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)` near the Phase 10 implementation plan links.
- Add a Phase 10j completed bullet to the current progress snapshot.
- Replace the current "Phase 10j next" text with the next conservative phase: `Phase 10k. Fixture Replay Depth And Golden Invariants`.
- Add a `### Phase 10j. Governed Fixture Refresh Review Workflow` section after Phase 10i.

The Phase 10j section must state:

- the guide exists;
- replacement remains manual;
- builder stdout and committed fixture writes are separate;
- verification uses `trace:fixtures`, `test:controlled-runtime`, `test:core-workflows`, lint, build, and diff check;
- no LLM/tool replay or store/asset writes were added.

- [x] **Step 2: Update Next Steps**

Modify `docs/NEXT_STEPS.md`:

- Add the refresh guide to the completed baseline.
- Convert `Recommended Next. Governed Fixture Refresh Review Workflow` to `Completed. Governed Fixture Refresh Review Workflow`.
- Add `Recommended Next. Fixture Replay Depth And Golden Invariants`.

The next recommendation should stay conservative:

- compare more fixture metadata against playbook contracts;
- keep replay pure;
- no real tool replay yet.

- [x] **Step 3: Update documentation index**

Modify `docs/DOCUMENTATION_INDEX.zh-CN.md` to include:

```markdown
- [Governed Trace Fixture Refresh Workflow](GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md)
```

Place it near other engineering/runtime documentation links.

- [x] **Step 4: Update changelog**

Add a `### Governed Fixture Refresh Review Workflow` entry to `CHANGELOG.md` under Unreleased, describing:

- new maintainer guide;
- manual replacement path;
- exact command recipe;
- continued no-side-effect boundary.

---

### Task 3: Verification, Records, And Commit

**Files:**
- Modify: `docs/superpowers/plans/2026-07-06-governed-fixture-refresh-review-workflow.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Check doc links and stale wording**

Run:

```bash
rg "Governed Trace Fixture Refresh Workflow|Phase 10j|Fixture Replay Depth" docs README.md CHANGELOG.md
rg "Recommended Next\\. Governed Fixture Refresh Review Workflow|还没有写成明确 refresh checklist" docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md CHANGELOG.md README.md
```

Expected:

- First command finds the new guide and Phase 10j/10k references.
- Second command returns no matches.

- [x] **Step 2: Run verification**

Run:

```bash
npm run trace:fixtures --silent
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- all commands exit 0;
- `trace:fixtures` reports `ok: true`, `total: 2`, `failed: 0`;
- `test:controlled-runtime` remains 28 files / 151 tests;
- `lint` and `build` may show only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [x] **Step 3: Update memory**

Append to `memory/2026-07-06.md`:

- Phase 10j completed;
- guide path;
- docs updated;
- verification results;
- next recommended phase.

- [x] **Step 4: Mark plan complete**

Mark all checklist items in this plan complete.

- [x] **Step 5: Commit docs**

Run:

```bash
git add docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/NEXT_STEPS.md docs/DOCUMENTATION_INDEX.zh-CN.md CHANGELOG.md docs/superpowers/plans/2026-07-06-governed-fixture-refresh-review-workflow.md
git commit -m "docs: add governed fixture refresh workflow"
```

---

## Plan Self-Review

- Spec coverage: guide, command recipe, review checklist, verification gates, docs links, changelog, memory, and no-side-effect boundaries are covered.
- Scope check: documentation-only; no runtime, CLI, route, store, fixture mutation script, or UI change.
- Placeholder scan: no unresolved placeholder work is required.
- Type consistency: no code types are introduced in this phase.
