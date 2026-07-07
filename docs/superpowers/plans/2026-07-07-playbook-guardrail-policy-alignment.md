# Playbook Guardrail Policy Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `playbook:control:audit` so it verifies resolved playbooks against runtime guardrails.

**Architecture:** Reuse the existing playbook control audit helper and add guardrail validation inside each playbook item. Import the exported `DEFAULT_GUARDRAILS` in both the audit helper and step executor so audit policy and runtime policy stay aligned.

**Tech Stack:** TypeScript, Vitest, existing playbook resolver, existing guardrails module, existing Node.js CLI wrapper.

---

### Task 1: RED Tests

**Files:**
- Modify: `src/__tests__/lib/executor/playbooks/control-audit.test.ts`

- [x] Add a passing expectation that current registered playbooks report guardrail policy compatibility.
- [x] Add a failing playbook with more steps than `DEFAULT_GUARDRAILS.maxSteps`.
- [x] Add a failing playbook that calls `file_write` without declaring approval.
- [x] Run targeted tests and confirm failures before implementation.

### Task 2: Audit Implementation

**Files:**
- Modify: `src/lib/executor/playbooks/control-audit.ts`

- [x] Resolve each playbook into an execution plan.
- [x] Validate each resolved plan with `validatePlan(plan, DEFAULT_GUARDRAILS)`.
- [x] Add compact guardrail metadata to each audit item.
- [x] Add findings for guardrail plan rejection and guarded tools without declared approval.

### Task 3: Runtime Default Policy Alignment

**Files:**
- Modify: `src/lib/executor/step-executor.ts`

- [x] Remove the local duplicate default guardrail constant.
- [x] Import `DEFAULT_GUARDRAILS` from `src/lib/executor/guardrails.ts`.
- [x] Preserve existing execution behavior.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `memory/2026-07-07.md`

- [x] Document that `playbook:control:audit` now covers default runtime guardrails.
- [x] Record the shared default guardrail source alignment.
- [x] Keep no-side-effect and non-production boundaries explicit.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/control-audit.test.ts src/__tests__/scripts/playbook-control-audit-script.test.ts src/__tests__/lib/executor/step-executor.test.ts`
- [x] `npm run playbook:control:audit`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
