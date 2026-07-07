# Playbook Lifecycle Mutation Post-Apply Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only evidence gate proving the post-apply audit sequence was recorded as green.

**Architecture:** Mirror the existing lifecycle sequence evidence checker, but consume the post-apply sequence report instead of the maintenance sequence report. The new checker validates recorded command results and post-apply audit side-effect boundaries without executing commands or refreshing fixtures.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing playbook lifecycle checker patterns.

---

### Task 1: Evidence Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence.ts`
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-post-apply-evidence.mjs`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence.test.ts`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-post-apply-evidence-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence.test.ts`

Expected: fail because the module does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/playbook-lifecycle-mutation-post-apply-evidence-script.test.ts`

Expected: fail because the script does not exist.

- [ ] **Step 3: Implement minimal validator and CLI**

The validator must accept only green referenced sequence reports, exact command result order, green command exits, required command metadata, and no fixture/store/external/publishing/production side effects.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-post-apply-evidence-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/playbook-lifecycle-mutation-post-apply-evidence/example-version-update-post-apply-evidence.json`
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

Add `playbook:lifecycle:mutation:post-apply:evidence:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example evidence**

The example evidence must reference the tracked post-apply sequence and record all seven required command results as green while keeping all post-apply side-effect boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say the post-apply sequence now has an evidence validation gate, and the next concrete gap is fixture refresh handoff.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-post-apply-evidence-script.test.ts
npm run playbook:lifecycle:mutation:post-apply:evidence:check -- --evidence docs/playbook-lifecycle-mutation-post-apply-evidence/example-version-update-post-apply-evidence.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers local evidence validation, sequence reuse, command order, command success, side-effect boundaries, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `post-apply evidence`, `sequence report`, `commandResults`, and boundary fields consistently.
