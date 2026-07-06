# Project Direction Documentation Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the project entry documents around the current Controlled Skill / Playbook Runtime direction and the next Phase 10v Real Replay Boundary Design work.

**Architecture:** This is a documentation-only alignment pass. It treats `docs/NEXT_STEPS.md` and `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md` as the freshest state sources, then updates older entry docs so they no longer describe completed phases as future work.

**Tech Stack:** Markdown documentation, existing npm verification scripts, git.

---

## File Structure

- Modify `README.md`: clarify stable public release versus current `main` engineering direction.
- Modify `docs/PROJECT_FRAMEWORK.zh-CN.md`: refresh current state, unfinished boundary, and next development direction.
- Modify `docs/ROADMAP.md`: replace stale near-term roadmap with Phase 10v and post-boundary replay work.
- Modify `docs/ARCHITECTURE.md`: update architecture status for support playbook, writeback targets, trace governance, and fixture replay.
- Modify `docs/DOCUMENTATION_INDEX.zh-CN.md`: surface the current runtime/governed trace reading path.
- Modify `docs/NEXT_STEPS.md`: record this alignment phase and keep Phase 10v as recommended next work.
- Modify `CHANGELOG.md`: add an Unreleased entry for project direction documentation alignment.
- Do not modify runtime source, fixtures, package scripts, UI components, or release notes.

## Task 1: Refresh Main Direction Documents

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update README current direction**

  Add a clear current engineering branch section near the existing positioning text:

  ```markdown
  ## 当前工程主线

  对外稳定线仍以 `v1.3.0` 发布资料为准；当前 `main` 分支的工程主线已经进入 Controlled Skill / Playbook Runtime。

  维护者优先阅读：

  - [项目框架总纲（中文）](docs/PROJECT_FRAMEWORK.zh-CN.md)
  - [可控 Agent Runtime 开发手册](docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md)
  - [当前执行 backlog](docs/NEXT_STEPS.md)
  - [Governed Trace Operational Runbook](docs/GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md)
  ```

- [ ] **Step 2: Update Project Framework current state**

  Replace stale “仍未完成” items with:

  ```markdown
  仍未完成：

  - Fixture replay 目前仍是 metadata-only 合约校验。
  - 真实 LLM / tool replay 的 sandbox、credential isolation、approval simulation、store isolation、side-effect blocking 和 replay result ownership 还没有设计。
  - 因此下一阶段必须先做 Phase 10v Real Replay Boundary Design，不能直接写真实 replay 代码。
  ```

- [ ] **Step 3: Replace Project Framework next direction**

  Replace the old P0-P4 list with Phase 10v-first ordering:

  ```markdown
  ### P0. Real Replay Boundary Design
  ### P1. No-Side-Effect Replay Sandbox Prototype
  ### P2. Governed Fixture / Playbook Expansion
  ### P3. Operational Retention And Maintenance Hardening
  ### P4. Runtime-Serving UI / App Polish
  ```

- [ ] **Step 4: Update Roadmap baseline and near-term list**

  Record completed baseline through Phase 10u and replace near-term roadmap with:

  ```markdown
  ### P0. Real Replay Boundary Design
  ### P1. No-Side-Effect Replay Sandbox Prototype
  ### P2. Governed Fixture And Playbook Expansion
  ### P3. Trace Operations Hardening
  ### P4. Runtime-Supporting UI And App Polish
  ```

- [ ] **Step 5: Commit direction documents**

  Run:

  ```bash
  git diff --check
  ```

  Expected: exit 0.

  Commit:

  ```bash
  git add README.md docs/PROJECT_FRAMEWORK.zh-CN.md docs/ROADMAP.md
  git commit -m "docs: align runtime direction documents"
  ```

## Task 2: Refresh Architecture And Documentation Index

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DOCUMENTATION_INDEX.zh-CN.md`

- [ ] **Step 1: Update architecture current modules**

  Add `support-resolution-v1` beside `sales-pipeline-v1`, update Runtime State responsibilities to include governed trace artifacts and fixture replay helpers, and update API list with the trace artifact route and retry route.

- [ ] **Step 2: Update architecture writeback state**

  Replace the stale `sales_asset` / `knowledge_asset` only section with current supported targets:

  ```markdown
  Controlled writeback currently supports:

  - `sales_asset`
  - `support_asset`
  - `knowledge_asset`
  - `workflow_run`
  - `draft`
  ```

  Add that real replay remains unimplemented and must not bypass the pure fixture replay boundary.

- [ ] **Step 3: Update documentation index**

  In the suggested reading order and internal engineering section, make these docs visible:

  - `ROADMAP.md`
  - `GOVERNED_TRACE_OPERATIONAL_RUNBOOK.zh-CN.md`
  - `GOVERNED_TRACE_FIXTURE_CI_GATES.zh-CN.md`
  - `GOVERNED_TRACE_FIXTURE_REPLAY_CONTRACT.zh-CN.md`
  - `GOVERNED_TRACE_FIXTURE_CATALOG_COVERAGE.zh-CN.md`

- [ ] **Step 4: Commit architecture/index refresh**

  Run:

  ```bash
  git diff --check
  ```

  Expected: exit 0.

  Commit:

  ```bash
  git add docs/ARCHITECTURE.md docs/DOCUMENTATION_INDEX.zh-CN.md
  git commit -m "docs: align architecture documentation index"
  ```

## Task 3: Record Alignment In Backlog And Changelog

**Files:**
- Modify: `docs/NEXT_STEPS.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add completed alignment section to Next Steps**

  Add a section before the recommended next phase:

  ```markdown
  ## Completed. Project Direction Documentation Alignment

  Why:

  - Main entry docs still mixed early controlled-runtime gaps with the current governed trace baseline.
  - Future sessions needed one consistent direction guardrail before starting real replay design.

  Delivered:

  - README, Project Framework, Roadmap, Architecture, Documentation Index, Next Steps, and Changelog now point to the same controlled runtime branch.
  - Completed baseline is stated through Phase 10u.
  - Next default phase remains Phase 10v Real Replay Boundary Design.
  - Generic OS shell expansion, generic skill marketplace work, and open-ended agent orchestration remain deprioritized until replay boundaries are designed.

  Outcome:

  - Maintainers can start from any major entry doc without drifting away from the controlled Playbook Runtime path.
  ```

- [ ] **Step 2: Add changelog entry**

  Under `## Unreleased`, add:

  ```markdown
  ### Project Direction Documentation Alignment

  - Aligned README, project framework, roadmap, architecture, documentation index, and next-stage backlog around the current Controlled Skill / Playbook Runtime branch.
  - Recorded the completed baseline through governed trace operational runbook work and kept Phase 10v Real Replay Boundary Design as the next default task.
  - Re-stated direction guardrails against generic OS shell expansion, generic skill marketplace work, and open-ended agent orchestration before controlled replay boundaries are designed.
  ```

- [ ] **Step 3: Commit records**

  Run:

  ```bash
  git diff --check
  ```

  Expected: exit 0.

  Commit:

  ```bash
  git add docs/NEXT_STEPS.md CHANGELOG.md
  git commit -m "docs: record direction alignment"
  ```

## Task 4: Final Verification

**Files:**
- Verify all modified docs.

- [ ] **Step 1: Run fixture gates**

  Run:

  ```bash
  npm run trace:fixtures --silent
  npm run trace:fixtures:summary --silent
  ```

  Expected: both commands exit 0 and report the committed governed fixture catalog as healthy.

- [ ] **Step 2: Run controlled runtime gate**

  Run:

  ```bash
  npm run test:controlled-runtime
  ```

  Expected: exit 0 with the current controlled runtime test count.

- [ ] **Step 3: Run core workflow and build gates**

  Run:

  ```bash
  npm run test:core-workflows
  npm run lint
  npm run build
  git diff --check
  ```

  Expected:

  - core workflow regressions pass,
  - lint exits 0, allowing the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`,
  - build exits 0, allowing the same existing warning,
  - whitespace check exits 0.

- [ ] **Step 4: Final status check**

  Run:

  ```bash
  git status --short
  ```

  Expected:

  - no unstaged tracked changes from this phase,
  - existing unrelated untracked local files may remain untouched.
