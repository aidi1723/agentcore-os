# Playbook Lifecycle Mutation Candidate Fixture Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only gate that validates an already-built governed trace fixture candidate after fixture refresh handoff and before committed fixture replacement.

**Architecture:** Follow the lifecycle mutation gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads review JSON, handoff JSON, post-apply evidence/sequence/apply report JSON through the handoff checker path, candidate fixture JSON, and committed fixture JSON; the validator composes handoff, fixture validation, and fixture replay reports before validating review evidence and boundaries.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing playbook lifecycle checker conventions, existing governed trace fixture validation/replay helpers.

---

### Task 1: Candidate Fixture Review Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review.ts`
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-candidate-fixture-review.mjs`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review.test.ts`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-candidate-fixture-review-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review.test.ts`

Expected: fail because the module does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/playbook-lifecycle-mutation-candidate-fixture-review-script.test.ts`

Expected: fail because the script does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless handoff is green, the catalog fixture id is listed in handoff intended fixture ids, candidate fixture validation and replay are green, candidate playbook matches the handoff target, review evidence is complete, and side-effect boundaries remain false.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-candidate-fixture-review-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/playbook-lifecycle-mutation-candidate-fixture-reviews/example-version-update-candidate-fixture-review.json`
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

Add `playbook:lifecycle:mutation:candidate-fixture:review:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example review**

The example must reference the tracked fixture refresh handoff, target `sales-pipeline-v1`, declare `sales-pipeline-governed`, point at the sales pipeline governed fixture as a deterministic review fixture, and keep all side-effect boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say candidate fixture review validation is now declared, and the next concrete gap is committed fixture replacement handoff / rollback evidence.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-candidate-fixture-review-script.test.ts
npm run playbook:lifecycle:mutation:candidate-fixture:review:check -- --review docs/playbook-lifecycle-mutation-candidate-fixture-reviews/example-version-update-candidate-fixture-review.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers handoff reuse, candidate fixture validation, replay compatibility, sensitive-marker review, target identity, side-effect boundary, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `candidate fixture review`, `handoffPath`, `catalogFixtureId`, `candidateFixturePath`, `committedFixturePath`, `reviewEvidence`, and `reviewBoundary` consistently.
