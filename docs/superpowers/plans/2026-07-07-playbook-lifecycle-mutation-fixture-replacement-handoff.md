# Playbook Lifecycle Mutation Fixture Replacement Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only gate that validates replacement handoff and rollback evidence after candidate fixture review and before manual committed fixture replacement.

**Architecture:** Follow the lifecycle mutation gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads handoff JSON and reuses the candidate fixture review CLI path; the validator checks review status, target/path alignment, rollback evidence, post-replacement validation plan, and no-side-effect boundaries.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing playbook lifecycle checker conventions.

---

### Task 1: Fixture Replacement Handoff Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff.ts`
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-fixture-replacement-handoff.mjs`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff.test.ts`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-fixture-replacement-handoff-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff.test.ts`

Expected: fail because the module does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/playbook-lifecycle-mutation-fixture-replacement-handoff-script.test.ts`

Expected: fail because the script does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless candidate review is green, handoff target/path fields match the review, committed fixture path is scoped, rollback evidence is complete, post-replacement validation plan is complete, and side-effect boundaries remain false.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-fixture-replacement-handoff-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/playbook-lifecycle-mutation-fixture-replacement-handoffs/example-version-update-fixture-replacement-handoff.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] **Step 1: Add npm script and controlled-runtime coverage**

Add `playbook:lifecycle:mutation:fixture-replacement:handoff:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example handoff**

The example must reference the tracked candidate fixture review, target `sales-pipeline-v1`, declare `sales-pipeline-governed`, point at the reviewed candidate and committed fixture paths, include rollback evidence, and keep all checker side-effect boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say fixture replacement handoff is now declared, and the next concrete gap is post-replacement fixture evidence validation.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-fixture-replacement-handoff-script.test.ts
npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff docs/playbook-lifecycle-mutation-fixture-replacement-handoffs/example-version-update-fixture-replacement-handoff.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers candidate review reuse, target/path alignment, rollback evidence, validation plan, side-effect boundary, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `fixture replacement handoff`, `candidateReviewPath`, `catalogFixtureId`, `targetPlaybookId`, `candidateFixturePath`, `committedFixturePath`, `rollbackEvidence`, and `replacementBoundary` consistently.
