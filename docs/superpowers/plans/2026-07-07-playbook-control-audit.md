# Playbook Control Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only gate that audits registered playbook control-chain completeness.

**Architecture:** Keep the audit logic in `src/lib/executor/playbooks/control-audit.ts` so tests can exercise it directly. Add a thin CLI wrapper in `scripts/playbooks/check-playbook-control.mjs`, wire it to `package.json`, and include it in `test:controlled-runtime`.

**Tech Stack:** TypeScript, Vitest, Node.js ESM scripts, existing playbook catalog/validator, existing governed fixture catalog report.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/control-audit.test.ts`
- Create: `src/__tests__/scripts/playbook-control-audit-script.test.ts`

- [x] Write tests for a passing registered catalog audit, missing fixture coverage, and writeback targets missing from `resultAssets`.
- [x] Write script tests for argument parsing and JSON report generation.
- [x] Run targeted tests and confirm they fail because the audit helper / script do not exist.

### Task 2: Audit Helper

**Files:**
- Create: `src/lib/executor/playbooks/control-audit.ts`
- Modify: `src/lib/executor/playbooks/sales-pipeline.ts`

- [x] Add `auditControlledPlaybookCatalog()` with injectable playbook and fixture catalog inputs.
- [x] Reuse `validateControlledPlaybook()` and fixture catalog report helpers instead of duplicating existing replay logic.
- [x] Fail closed on missing declared writeback targets.
- [x] Align `sales-pipeline-v1.resultAssets` with its actual durable writebacks.

### Task 3: CLI And Gate Wiring

**Files:**
- Create: `scripts/playbooks/check-playbook-control.mjs`
- Modify: `package.json`

- [x] Add `npm run playbook:control:audit`.
- [x] Include the new test files and audit command in `test:controlled-runtime`.
- [x] Ensure the command prints JSON and exits non-zero on findings.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `memory/2026-07-07.md`

- [x] Record the current design-goal completion status.
- [x] Document the new audit command and its no-side-effect boundary.
- [x] Update the next-phase backlog around policy hardening, replay depth, and playbook lifecycle.

### Task 5: Verification

- [x] `npm test -- src/__tests__/lib/executor/playbooks/control-audit.test.ts src/__tests__/scripts/playbook-control-audit-script.test.ts`
- [x] `npm run playbook:control:audit`
- [x] `npm run test:controlled-runtime`
- [x] `npm run test:core-workflows`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
