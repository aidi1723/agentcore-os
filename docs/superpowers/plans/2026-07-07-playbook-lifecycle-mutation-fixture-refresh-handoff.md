# Playbook Lifecycle Mutation Fixture Refresh Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only gate that confirms green post-apply evidence can move into manual fixture refresh review handoff.

**Architecture:** Mirror the lifecycle mutation gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads handoff JSON, referenced post-apply evidence JSON, referenced sequence JSON, and referenced apply report JSON, then composes existing validators before validating the handoff contract.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing lifecycle mutation checker conventions.

---

### Task 1: Fixture Refresh Handoff Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-fixture-refresh-handoff.ts`
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-fixture-refresh-handoff.mjs`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-refresh-handoff.test.ts`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-fixture-refresh-handoff-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-refresh-handoff.test.ts`

Expected: fail because the module does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/playbook-lifecycle-mutation-fixture-refresh-handoff-script.test.ts`

Expected: fail because the script does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless post-apply evidence is green, target playbook matches, intended fixture ids are present, checklist gates are declared, and side-effect boundaries remain false.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-refresh-handoff.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-fixture-refresh-handoff-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/playbook-lifecycle-mutation-fixture-refresh-handoffs/example-version-update-fixture-refresh-handoff.json`
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

Add `playbook:lifecycle:mutation:fixture-refresh:handoff:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example handoff**

The example must reference the tracked post-apply evidence, target `sales-pipeline-v1`, declare `sales-pipeline-governed`, and keep all side-effect boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say fixture refresh handoff is now declared, and the next concrete gap is candidate fixture review validation.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-fixture-refresh-handoff.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-fixture-refresh-handoff-script.test.ts
npm run playbook:lifecycle:mutation:fixture-refresh:handoff:check -- --handoff docs/playbook-lifecycle-mutation-fixture-refresh-handoffs/example-version-update-fixture-refresh-handoff.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers post-apply evidence reuse, handoff target validation, checklist completeness, side-effect boundary, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `fixture refresh handoff`, `postApplyEvidencePath`, `intendedFixtureIds`, `reviewChecklist`, and `handoffBoundary` consistently.
