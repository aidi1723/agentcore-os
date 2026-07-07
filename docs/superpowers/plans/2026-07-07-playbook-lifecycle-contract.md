# Playbook Lifecycle Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require lifecycle metadata on registered controlled playbooks and audit it locally.

**Architecture:** Extend the playbook type and current playbook definitions, then add lifecycle validation to the existing `playbook:control:audit` helper. Keep the command read-only and reuse the existing audit CLI.

**Tech Stack:** TypeScript, Vitest, existing playbook catalog and control-audit helper.

---

### Task 1: RED Tests

**Files:**
- Modify: `src/__tests__/lib/executor/playbooks/control-audit.test.ts`

- [x] Assert current registered playbook audit items include lifecycle metadata.
- [x] Add a missing-lifecycle regression that expects a fail-closed finding.
- [x] Add a malformed-lifecycle regression that expects a fail-closed finding.
- [x] Run the targeted test and confirm it fails before implementation.

### Task 2: Lifecycle Types And Playbooks

**Files:**
- Modify: `src/lib/executor/playbooks/types.ts`
- Modify: `src/lib/executor/playbooks/sales-pipeline.ts`
- Modify: `src/lib/executor/playbooks/support-resolution.ts`

- [x] Add `ControlledPlaybookLifecycle` and require it on `ControlledPlaybook`.
- [x] Add active lifecycle metadata to sales and support playbooks.

### Task 3: Audit Implementation

**Files:**
- Modify: `src/lib/executor/playbooks/control-audit.ts`

- [x] Include lifecycle metadata in audit items.
- [x] Validate status, owner, last-reviewed date, review cadence, and change policy.
- [x] Add `missing_lifecycle_metadata` and `invalid_lifecycle_metadata` findings.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `memory/2026-07-07.md`

- [x] Document lifecycle metadata as part of the control-chain contract.
- [x] Record that this closes the first lifecycle-contract slice, not the full authoring UI.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/control-audit.test.ts src/__tests__/scripts/playbook-control-audit-script.test.ts`
- [x] `npm run playbook:control:audit`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
