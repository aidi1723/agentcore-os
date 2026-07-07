# Playbook Deprecated Lifecycle Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require registered deprecated playbooks to declare deprecation metadata and a valid replacement playbook.

**Architecture:** Extend the lifecycle type with optional deprecation fields and keep validation inside `src/lib/executor/playbooks/control-audit.ts`, because that command is the existing fail-closed playbook contract gate. Tests use synthetic deprecated playbooks so current registered active playbooks remain unchanged.

**Tech Stack:** TypeScript, Vitest, existing playbook catalog and control-audit helper.

---

### Task 1: RED Tests

**Files:**
- Modify: `src/__tests__/lib/executor/playbooks/control-audit.test.ts`

- [x] Add a regression showing a deprecated playbook with complete metadata and registered replacement can pass the control audit.
- [x] Add a regression showing a deprecated playbook without deprecation metadata fails closed.
- [x] Add a regression showing a deprecated playbook with an unknown replacement fails closed.
- [x] Run the targeted control audit test and confirm it fails before implementation.

### Task 2: Lifecycle Type

**Files:**
- Modify: `src/lib/executor/playbooks/types.ts`

- [x] Add optional `deprecatedAt`, `deprecationReason`, and `replacementPlaybookId` fields to `ControlledPlaybookLifecycle`.
- [x] Keep active and experimental playbooks compatible without deprecation fields.

### Task 3: Control Audit Implementation

**Files:**
- Modify: `src/lib/executor/playbooks/control-audit.ts`

- [x] Pass registered playbook ids into per-playbook lifecycle validation.
- [x] Validate deprecated lifecycle metadata.
- [x] Add `invalid_deprecation_metadata`, `deprecated_replacement_self_reference`, and `deprecated_replacement_not_registered` findings.
- [x] Preserve local read-only audit behavior.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [x] Document deprecated lifecycle metadata as a contract-layer step toward versioning/deprecation workflow.
- [x] Record that no authoring UI, migration runner, fixture mutation, or publication was added.
- [x] Update controlled runtime test count after verification if it changes.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/control-audit.test.ts src/__tests__/scripts/playbook-control-audit-script.test.ts`
- [x] `npm run playbook:control:audit`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
