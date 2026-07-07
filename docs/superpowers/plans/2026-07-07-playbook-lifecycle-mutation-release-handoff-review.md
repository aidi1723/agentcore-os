# Playbook Lifecycle Mutation Release Handoff Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only review gate that connects green post-replacement fixture evidence to existing release handoff evidence review without publishing or production claims.

**Architecture:** Follow the lifecycle mutation gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads review JSON and reuses the post-replacement evidence CLI path; the validator checks green evidence linkage, ordered release handoff command evidence, command-specific metadata, reviewer acceptance, rollback notes, and non-production boundaries.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing playbook lifecycle and release handoff checker conventions.

---

### Task 1: Release Handoff Review Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-mutation-release-handoff-review.ts`
- Create: `scripts/playbooks/check-playbook-lifecycle-mutation-release-handoff-review.mjs`
- Test: `src/__tests__/lib/executor/playbooks/lifecycle-mutation-release-handoff-review.test.ts`
- Test: `src/__tests__/scripts/playbook-lifecycle-mutation-release-handoff-review-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-release-handoff-review.test.ts`

Expected: fail because the module does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/playbook-lifecycle-mutation-release-handoff-review-script.test.ts`

Expected: fail because the script does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless the referenced post-replacement evidence is green, command results are ordered and green, command-specific release handoff metadata is present, reviewer acceptance and rollback notes are present, and side-effect boundaries remain review-only and non-production.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-release-handoff-review.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-release-handoff-review-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/playbook-lifecycle-mutation-release-handoff-reviews/example-version-update-release-handoff-review.json`
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

Add `playbook:lifecycle:mutation:release-handoff:review:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example review**

The example must reference the tracked post-replacement evidence, record green post-replacement/release handoff/snapshot/status/audit/diff command evidence, and keep publication/production boundaries false.

- [ ] **Step 3: Update documentation**

Update project docs to say release handoff review integration is now declared, and the next concrete gap remains separate from publishing and production readiness.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/lifecycle-mutation-release-handoff-review.test.ts src/__tests__/scripts/playbook-lifecycle-mutation-release-handoff-review-script.test.ts
npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review docs/playbook-lifecycle-mutation-release-handoff-reviews/example-version-update-release-handoff-review.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers post-replacement evidence reuse, release handoff command evidence, command-specific metadata, reviewer acceptance, side-effect boundaries, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `release handoff review`, `postReplacementEvidencePath`, `reviewSummary`, `commandResults`, and `releaseHandoffReviewBoundary` consistently.
