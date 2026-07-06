# Runtime Console Delivery Readiness Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document whether Runtime Console is ready to serve as the primary controlled playbook delivery surface.

**Architecture:** This is a documentation-only audit phase. It reads the current Runtime Console UI and test coverage, then writes a structured delivery-readiness guide with ready/blocker/deferred decisions and aligns project entry documents.

**Tech Stack:** Markdown documentation, existing React/TypeScript source references, existing npm verification scripts, git.

---

## File Structure

- Create `docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md`
  - Delivery story, readiness matrix, blockers, deferred work, verification gate.
- Modify `docs/DOCUMENTATION_INDEX.zh-CN.md`
  - Add the audit to the recommended reading path and internal engineering docs.
- Modify `README.md`
  - Add the audit to maintainer reading links.
- Modify `docs/NEXT_STEPS.md`
  - Record the audit as the current completed checkpoint and set the next phase.
- Modify `docs/ROADMAP.md`
  - Mark Runtime Console Delivery Readiness Audit as completed and keep later fixture/playbook expansion behind the checkpoint.
- Modify `docs/PROJECT_FRAMEWORK.zh-CN.md`
  - Mark the audit as completed and add Delivery Demo Smoke Path as the next phase.
- Modify `CHANGELOG.md`
  - Add the audit documentation entry.
- Modify this plan after implementation with completion notes.

---

### Task 1: Create Runtime Console Delivery Audit

**Files:**
- Create: `docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md`

- [x] **Step 1: Write audit document**

Create a Chinese audit document with these sections:

```markdown
# Runtime Console Delivery Readiness Audit

## 1. 当前结论
## 2. 可交付演示主线
## 3. Readiness Matrix
## 4. 当前阻塞项
## 5. 可延期项
## 6. 交付前验证门禁
## 7. 下一阶段建议
```

- [x] **Step 2: Check document scope**

Confirm the audit does not add new backend behavior, real replay, fixture JSON, or UI redesign requirements.

---

### Task 2: Align Entry Documentation

**Files:**
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Link audit from documentation index**

Add `RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md` to the suggested reading order and internal engineering section.

- [x] **Step 2: Record audit in Next Steps**

Add a completed Runtime Console Delivery Readiness Audit section and set the next recommended phase to Delivery Demo Smoke Path.

- [x] **Step 3: Update roadmap**

Mark Runtime Console Delivery Readiness Audit as completed and place Delivery Demo Smoke Path before governed fixture/playbook expansion.

- [x] **Step 4: Update changelog**

Record the audit documentation in Unreleased.

---

### Task 3: Verify And Record

**Files:**
- Modify: this plan

- [x] **Step 1: Run verification**

Run:

```bash
git diff --check
npm run test:controlled-runtime
npm run build
```

Expected: all commands exit 0. The existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx` may remain.

- [x] **Step 2: Add completion notes**

Record created files, updated docs, verification evidence, and next phase.

- [x] **Step 3: Commit**

```bash
git add docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md docs/DOCUMENTATION_INDEX.zh-CN.md docs/NEXT_STEPS.md docs/ROADMAP.md docs/PROJECT_FRAMEWORK.zh-CN.md README.md CHANGELOG.md docs/superpowers/specs/2026-07-06-runtime-console-delivery-readiness-audit-design.md docs/superpowers/plans/2026-07-06-runtime-console-delivery-readiness-audit.md
git diff --check --cached
git commit -m "docs: add runtime console delivery readiness audit"
```

---

## Completion Notes

Completed on 2026-07-06.

Delivered:

- Runtime Console Delivery Readiness Audit document.
- Documentation index, Next Steps, Roadmap, and Changelog alignment.
- Next recommended phase: Delivery Demo Smoke Path.

Verification:

- `git diff --check` — exit 0.
- `npm run test:controlled-runtime` — 36 files / 191 tests passed.
- `npm run build` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
