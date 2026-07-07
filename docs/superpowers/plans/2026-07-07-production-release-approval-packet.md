# Production Release Approval Packet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only production release approval packet gate after production release policy review.

**Architecture:** Follow the current gate pattern: a pure TypeScript validator plus a Node ESM CLI wrapper. The CLI reads one approval JSON file, reuses the production release policy checker, and passes parsed reports into the validator. The checker validates approval identity, scope, expiry, owners, action decisions, command evidence, and no-action boundaries without publishing, tagging, packaging, uploading, deploying, using credentials, or claiming production readiness.

**Tech Stack:** TypeScript, Vitest, Node ESM CLI scripts, existing production release policy checker conventions.

---

### Task 1: Approval Packet Contract And CLI

**Files:**
- Create: `src/lib/executor/playbooks/production-release-approval.ts`
- Create: `scripts/release-approval/check-production-release-approval.mjs`
- Test: `src/__tests__/lib/executor/playbooks/production-release-approval.test.ts`
- Test: `src/__tests__/scripts/production-release-approval-check-script.test.ts`

- [ ] **Step 1: Write failing library tests**

Run: `npm test -- src/__tests__/lib/executor/playbooks/production-release-approval.test.ts`

Expected: fail because `src/lib/executor/playbooks/production-release-approval.ts` does not exist.

- [ ] **Step 2: Write failing CLI tests**

Run: `npm test -- src/__tests__/scripts/production-release-approval-check-script.test.ts`

Expected: fail because `scripts/release-approval/check-production-release-approval.mjs` does not exist.

- [ ] **Step 3: Implement validator and CLI**

The validator must fail closed unless production policy evidence is green, command evidence is ordered and green, reviewer/scope/expiry/owner fields are valid, release action decisions are documented and not executed, risk acceptance remains bounded, and the approval boundary remains approval-packet-only.

- [ ] **Step 4: Verify targeted tests pass**

Run: `npm test -- src/__tests__/lib/executor/playbooks/production-release-approval.test.ts src/__tests__/scripts/production-release-approval-check-script.test.ts`

Expected: both files pass.

### Task 2: Example, Script Wiring, Docs, Verification

**Files:**
- Create: `docs/release-approvals/example-production-release-approval.json`
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

Add `release:production-approval:check` and include both new tests in `test:controlled-runtime`.

- [ ] **Step 2: Add tracked example approval packet**

The example must reference the tracked production release policy, summarize green policy/runtime/core/lint/build/diff evidence, include reviewer identity, approval scope, expiry, rollback owner, monitoring owner, release action decisions, risk acceptance, and approval-packet-only boundaries.

- [ ] **Step 3: Update documentation**

Update project docs to say production release approval packet hardening is now declared, and the next concrete gap is release execution planning gates for packaging/tag/upload/deployment, still separate from publishing, tag creation, packaging, upload, deployment, external writes, credential use, and production readiness claims.

- [ ] **Step 4: Verify full gate set**

Run:

```bash
npm test -- src/__tests__/lib/executor/playbooks/production-release-approval.test.ts src/__tests__/scripts/production-release-approval-check-script.test.ts
npm run release:production-approval:check -- --approval docs/release-approvals/example-production-release-approval.json --compact
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: commands pass; lint/build may retain the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Self-Review

- Spec coverage: covers policy reuse, approval identity, scope, expiry, command evidence, release action decisions, rollback/monitoring ownership, risk acceptance, no-action boundary, tests, docs, and verification.
- Placeholder scan: no placeholders remain.
- Type consistency: uses `production release approval`, `productionPolicyPath`, `releaseActionDecisions`, `rollbackOwner`, `monitoringOwner`, `approvalBoundary`, and `approvalPacketOnly` consistently.
