# Production Release Policy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only production release policy gate that validates a policy packet after local delivery candidate readiness and before any production release action.

**Architecture:** Follow the current gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one policy JSON file, reuses the delivery candidate checker, and passes parsed reports into the validator. The checker validates recorded evidence and policy boundaries without publishing, tagging, packaging, uploading, deploying, using credentials, or claiming production readiness.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing release and delivery candidate checker conventions.

---

### Task 1: Production Release Policy Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/production-release-policy.ts`
- Create: `scripts/release-policy/check-production-release-policy.mjs`
- Test: `src/__tests__/lib/executor/playbooks/production-release-policy.test.ts`
- Test: `src/__tests__/scripts/production-release-policy-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/production-release-policy.test.ts`

Expected: fail because `src/lib/executor/playbooks/production-release-policy.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/production-release-policy-check-script.test.ts`

Expected: fail because `scripts/release-policy/check-production-release-policy.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless delivery candidate evidence is green, command evidence is ordered and green, required policy sections are present and not executed, risk/rollback summaries preserve non-production boundaries, and release boundary remains policy-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/production-release-policy.test.ts src/__tests__/scripts/production-release-policy-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-policies/example-production-release-policy.json`
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

Add `release:production-policy:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example policy**

The example must reference the tracked delivery candidate, summarize green candidate/hygiene/runtime/core/lint/build/diff evidence, define packaging/tag/upload/deployment/external-write/monitoring/rollback policy sections, and keep all release actions unapproved and unexecuted.

- [ ] **Step 3: Update documentation**

Update project docs to say production release policy hardening is now declared, and the next concrete gap is a production release approval packet, still separate from publishing, tag creation, packaging, upload, deployment, external writes, and production readiness claims.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/production-release-policy.test.ts src/__tests__/scripts/production-release-policy-check-script.test.ts
npm run release:production-policy:check -- --policy docs/release-policies/example-production-release-policy.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers delivery candidate reuse, policy identity, command evidence, release policy sections, risk summary, rollback summary, release boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `production release policy`, `deliveryCandidatePath`, `commandEvidence`, `policySections`, `riskSummary`, `rollbackSummary`, and `releaseBoundary` consistently.
