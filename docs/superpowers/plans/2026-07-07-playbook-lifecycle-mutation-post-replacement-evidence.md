# Playbook Lifecycle Mutation Post-Replacement Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only gate that validates recorded evidence after manual committed fixture replacement.

**Architecture:** Follow the lifecycle mutation gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads evidence JSON and reuses the fixture replacement handoff CLI path; the validator checks green handoff linkage, replacement summary alignment, ordered command evidence, command-specific metadata, rollback proof, and non-production boundaries.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing playbook lifecycle checker conventions.

---

### Task 1: Post-Replacement Evidence Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-post-replacement-evidence.ts`
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-post-replacement-evidence.mjs`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-replacement-evidence.test.ts`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-post-replacement-evidence-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-replacement-evidence.test.ts`

Expected: fail because the module does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/playbook-lifecycle-mutation-post-replacement-evidence-script.test.ts`

Expected: fail because the script does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless the replacement handoff is green, replacement summary aligns with the handoff, command results are ordered and green, command-specific metadata is present, rollback/diff evidence is present, and side-effect boundaries remain non-production.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-replacement-evidence.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-post-replacement-evidence-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/playbook-lifecycle-mutation-post-replacement-evidence/example-version-update-post-replacement-evidence.json`
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

Add `playbook:lifecycle:mutation:post-replacement:evidence:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example evidence**

The example must reference the tracked fixture replacement handoff, record green handoff/fixture/runtime/core/diff command evidence, and keep publication/production boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say post-replacement evidence is now declared, and the next concrete gap is release handoff review integration without production readiness claims.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-post-replacement-evidence.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-post-replacement-evidence-script.test.ts
npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence docs/playbook-lifecycle-mutation-post-replacement-evidence/example-version-update-post-replacement-evidence.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers handoff reuse, replacement summary alignment, ordered evidence, command-specific metadata, side-effect boundaries, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `post-replacement evidence`, `replacementHandoffPath`, `replacementSummary`, `commandResults`, and `postReplacementBoundary` consistently.
