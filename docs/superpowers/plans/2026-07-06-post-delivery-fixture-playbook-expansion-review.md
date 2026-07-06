# Post-Delivery Fixture And Playbook Expansion Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a post-delivery review gate proving registered controlled playbooks and committed governed fixtures remain aligned, then record that no new fixture or playbook expansion is needed immediately after delivery smoke.

**Architecture:** Extend the existing governed fixture catalog test with a playbook coverage invariant. Add a docs-only review report and align project records so future work starts from a review decision instead of automatic expansion.

**Tech Stack:** Vitest, existing controlled playbook catalog, existing governed trace fixture catalog, Markdown docs.

---

## File Structure

- Modify: `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`
  - Add the coverage invariant between registered playbooks and committed governed fixtures.
- Create: `docs/POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md`
  - Record the post-delivery review matrix and decision.
- Modify: `docs/NEXT_STEPS.md`
  - Mark this review completed and set the next recommended phase.
- Modify: `docs/ROADMAP.md`
  - Record P14 as completed review, not automatic expansion.
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - Align current phase status and next direction.
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - Link the post-delivery review document.
- Modify: `CHANGELOG.md`
  - Record the review.
- Modify: this plan
  - Track completion and verification.

## Task 1: RED Coverage Invariant

**Files:**
- Modify: `src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts`

- [ ] **Step 1: Add failing test**

Add imports:

```ts
import { listControlledPlaybooks } from "@/lib/executor/playbooks/catalog";
```

Add this test after `lists sales and support governed fixtures`:

```ts
  it("covers every registered controlled playbook with one committed governed fixture", () => {
    const registeredPlaybookIds = listControlledPlaybooks().map((playbook) => playbook.id);
    const fixturePlaybookIds = controlledTraceFixtureCatalog.map((entry) => entry.playbookId);

    expect(fixturePlaybookIds).toEqual(registeredPlaybookIds);
    expect(new Set(fixturePlaybookIds).size).toBe(fixturePlaybookIds.length);
  });
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
```

Expected: this may pass immediately if the current invariant already holds. If it passes, make the RED check explicit by temporarily changing the expected fixture list in the test to `fixturePlaybookIds.slice(0, 1)`, verify it fails, then restore the intended assertion before implementation commit.

- [ ] **Step 3: Commit coverage test**

```bash
git add src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
git diff --check --cached
git commit -m "test: assert governed fixture playbook coverage"
```

## Task 2: Review Document

**Files:**
- Create: `docs/POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md`

- [ ] **Step 1: Add review document**

Create the document with:

```markdown
# Post-Delivery Fixture And Playbook Expansion Review

Last updated: 2026-07-06

## 1. Decision

Current decision: do not add a new committed fixture or migrate a new controlled playbook immediately after delivery smoke.

Reason:

- registered playbooks are already covered by committed governed fixtures;
- delivery demo data is local seed/check data, not a governed trace fixture source;
- browser smoke did not reveal a new playbook contract gap;
- real replay remains out of scope.

## 2. Current Coverage

| Area | Current state | Decision |
| --- | --- | --- |
| Registered playbooks | `sales-pipeline-v1`, `support-resolution-v1` | Covered |
| Committed governed fixtures | `sales-pipeline-governed`, `support-resolution-governed` | Covered |
| Delivery demo runs | completed, awaiting approval, retryable failed | Keep as local demo data, not fixtures |
| Writeback target families | sales, support, knowledge, workflow, draft | Covered by sales/support fixture families |
| Real replay | Not implemented | Keep blocked behind replay boundary |

## 3. Expansion Rules

Add a new fixture only when a new durable contract appears:

- a new registered playbook;
- a new durable writeback target family;
- a stable replay terminal-state contract for failed/rejected/awaiting runs;
- a real governed artifact exposes a contract gap not covered by synthetic failures.

Add a new controlled playbook only after:

- a business scenario is selected;
- spec and plan are approved;
- TDD coverage exists;
- governed trace / replay gates stay green;
- writeback and approval boundaries are explicit.

## 4. Next Direction

Recommended next phase: Trace Operations Hardening.

Focus:

- retention and artifact handoff discipline;
- release checklist alignment;
- fixture refresh stop conditions;
- browser evidence repeatability;
- no real replay or new playbook until a separate spec justifies it.
```

- [ ] **Step 2: Commit review document**

```bash
git add docs/POST_DELIVERY_FIXTURE_PLAYBOOK_EXPANSION_REVIEW.zh-CN.md
git diff --check --cached
git commit -m "docs: add post-delivery expansion review"
```

## Task 3: Align Project Records

**Files:**
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: this plan

- [ ] **Step 1: Update project records**

Record:

- Post-delivery review completed.
- No new fixture JSON now.
- No new controlled playbook now.
- Next recommended phase: Trace Operations Hardening.

- [ ] **Step 2: Verify stale text is gone**

Run:

```bash
rg "Recommended Next\\. Governed Fixture And Playbook Expansion Review|当前下一阶段是 Governed Fixture" docs README.md CHANGELOG.md
```

Expected: no matches after docs are aligned.

- [ ] **Step 3: Commit record alignment**

```bash
git add docs/NEXT_STEPS.md docs/ROADMAP.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md CHANGELOG.md docs/superpowers/plans/2026-07-06-post-delivery-fixture-playbook-expansion-review.md
git diff --check --cached
git commit -m "docs: record post-delivery expansion decision"
```

## Task 4: Final Verification

- [ ] **Step 1: Run focused verification**

```bash
git diff --check
npm test -- src/__tests__/lib/executor/runtime/trace-fixture-catalog.test.ts
npm run trace:fixtures --silent
npm run replay:sandbox:fixtures --silent
```

Expected: all exit 0.

- [ ] **Step 2: Run controlled runtime gate**

```bash
npm run test:controlled-runtime
```

Expected: all controlled runtime tests pass.

- [ ] **Step 3: Record completion**

Update this plan with final verification output and commit if needed.

## Completion Notes

Pending implementation.
