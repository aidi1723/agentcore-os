# Playbook Lifecycle Mutation Handoff Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only handoff summary gate that condenses green release handoff review evidence into a maintainer-readable non-production summary.

**Architecture:** Follow the lifecycle mutation gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads summary JSON and reuses the release handoff review CLI path; the validator checks green review linkage, ordered command summaries, risk/rollback summaries, and no-side-effect boundaries.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing playbook lifecycle checker conventions.

---

### Task 1: Handoff Summary Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-handoff-summary.ts`
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-handoff-summary.mjs`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-handoff-summary.test.ts`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-handoff-summary-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-handoff-summary.test.ts`

Expected: fail because the module does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/playbook-lifecycle-mutation-handoff-summary-script.test.ts`

Expected: fail because the script does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless the referenced release handoff review is green, command summaries are ordered and green, risk/rollback summaries preserve non-production boundaries, and side-effect boundaries remain summary-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-handoff-summary.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-handoff-summary-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/playbook-lifecycle-mutation-handoff-summaries/example-version-update-handoff-summary.json`
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

Add `playbook:lifecycle:mutation:handoff:summary:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example summary**

The example must reference the tracked release handoff review, summarize green review/runtime/core/lint/build/diff evidence, keep deferred production work explicit, and keep publication/production boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say handoff summary hardening is now declared, and the next concrete gap is unified policy/guardrail or authoring workflow hardening, still separate from publishing and production readiness.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-handoff-summary.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-handoff-summary-script.test.ts
npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary docs/playbook-lifecycle-mutation-handoff-summaries/example-version-update-handoff-summary.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers release handoff review reuse, handoff summary fields, command summary, risk summary, rollback summary, side-effect boundaries, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `handoff summary`, `releaseHandoffReviewPath`, `handoffSummary`, `commandSummary`, `riskSummary`, `rollbackSummary`, and `handoffSummaryBoundary` consistently.
