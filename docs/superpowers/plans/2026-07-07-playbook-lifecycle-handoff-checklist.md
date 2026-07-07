# Playbook Lifecycle Handoff Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local read-only checklist command for playbook versioning and deprecation handoff readiness.

**Architecture:** Add a focused helper in `src/lib/executor/playbooks/lifecycle-handoff.ts` that consumes existing control-audit and lifecycle-review reports. Add a thin CLI wrapper in `scripts/playbooks/` that builds those reports from the registered catalog and existing governed fixture catalog, then wire the command into `package.json`.

**Tech Stack:** TypeScript, Vitest, Node CLI, existing playbook catalog, existing control audit, existing lifecycle review diagnostic.

---

### Task 1: RED Tests

**Files:**
- Create: `src/__tests__/lib/executor/playbooks/lifecycle-handoff.test.ts`
- Create: `src/__tests__/scripts/playbook-lifecycle-handoff-script.test.ts`

- [ ] Add a helper test proving current registered reports are ready for lifecycle handoff.
- [ ] Add a helper test proving due lifecycle review findings block handoff.
- [ ] Add a helper test proving deprecated replacement chains are summarized when present.
- [ ] Add CLI argument parsing tests for default, `--compact`, and `--now`.
- [ ] Add CLI result tests for current catalog and deterministic due-review failure.
- [ ] Run targeted tests and confirm they fail before implementation.

### Task 2: Handoff Helper

**Files:**
- Create: `src/lib/executor/playbooks/lifecycle-handoff.ts`

- [ ] Export `PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND`.
- [ ] Add report, check, finding, and deprecated replacement summary types.
- [ ] Build readiness from `controlAudit.ok && lifecycleReview.ok`.
- [ ] Add findings for non-green control audit and non-green lifecycle review.
- [ ] Preserve read-only, local, non-production metadata.

### Task 3: CLI And Package Script

**Files:**
- Create: `scripts/playbooks/check-playbook-lifecycle-handoff.mjs`
- Modify: `package.json`

- [ ] Parse `--compact` and `--now YYYY-MM-DD`.
- [ ] Build control audit from registered playbooks and governed fixture catalog.
- [ ] Build lifecycle review from registered playbooks.
- [ ] Add `npm run playbook:lifecycle:handoff`.
- [ ] Add helper and script tests to `test:controlled-runtime`.

### Task 4: Docs And Records

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `memory/2026-07-07.md`

- [ ] Document `playbook:lifecycle:handoff` as the local version/deprecation handoff checklist.
- [ ] Record that this aggregates existing gates and does not add authoring UI, migration execution, fixture mutation, publishing, or production readiness.
- [ ] Update the controlled runtime test count after verification.

### Task 5: Verification

- [ ] `npm test -- src/__tests__/lib/executor/playbooks/lifecycle-handoff.test.ts src/__tests__/scripts/playbook-lifecycle-handoff-script.test.ts`
- [ ] `npm run playbook:lifecycle:handoff`
- [ ] `npm run playbook:lifecycle:handoff -- --now 2027-01-03 --compact`
- [ ] `npm run test:controlled-runtime`
- [ ] `npm run test:core-workflows`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
