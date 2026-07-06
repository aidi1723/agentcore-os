# GPLv3 License Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change AgentCore OS current source license metadata from Apache-2.0 to GPL-3.0-or-later while preserving the historical Apache-2.0 boundary for earlier releases.

**Architecture:** This is a repository governance/documentation change. It updates the canonical license file, package metadata, public README/NOTICE text, release checklist, changelog, and a dedicated migration notice without changing runtime behavior.

**Tech Stack:** Markdown, JSON metadata, GNU GPLv3 canonical license text, existing npm verification scripts, git.

---

## File Structure

- Replace `LICENSE`: GNU GPL version 3 canonical text from `https://www.gnu.org/licenses/gpl-3.0.txt`.
- Modify `package.json`: set `"license": "GPL-3.0-or-later"`.
- Modify `package-lock.json`: set the root package license to `"GPL-3.0-or-later"` while leaving dependency license entries untouched.
- Modify `README.md`: update license badge and open-source protocol section.
- Modify `NOTICE`: update current source license and keep brand/trademark carve-out.
- Modify `docs/OPEN_SOURCE_CHECKLIST.md`: add migration-specific license checks.
- Create `docs/LICENSE_CHANGE_NOTICE.md`: record effective boundary and historical Apache-2.0 preservation.
- Modify `CHANGELOG.md`: add the migration under Unreleased.
- Update local memory only after verification; do not commit local memory files.

## Task 1: Replace Canonical License Metadata

**Files:**
- Modify: `LICENSE`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Verify downloaded GPLv3 source**

  Run:

  ```bash
  shasum -a 256 /tmp/gpl-3.0.txt
  sed -n '1,7p' /tmp/gpl-3.0.txt
  ```

  Expected:

  - SHA-256 is `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`.
  - Header says `GNU GENERAL PUBLIC LICENSE`, `Version 3, 29 June 2007`.

- [ ] **Step 2: Replace LICENSE with canonical text**

  Run:

  ```bash
  cp /tmp/gpl-3.0.txt LICENSE
  ```

  Expected: `LICENSE` starts with GNU GPLv3 header.

- [ ] **Step 3: Update package license metadata**

  Change `package.json` and the root package record in `package-lock.json`:

  ```json
  "license": "GPL-3.0-or-later"
  ```

- [ ] **Step 4: Verify metadata**

  Run:

  ```bash
  sed -n '1,8p' LICENSE
  rg -n '"license": "GPL-3.0-or-later"' package.json
  sed -n '1,16p' package-lock.json
  ```

  Expected:

  - GPLv3 header is present.
  - package license fields match `GPL-3.0-or-later`.

## Task 2: Update Public License Documents

**Files:**
- Modify: `README.md`
- Modify: `NOTICE`
- Create: `docs/LICENSE_CHANGE_NOTICE.md`

- [ ] **Step 1: Update README badge**

  Replace the Apache badge with:

  ```markdown
  [![License: GPL v3+](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](LICENSE)
  ```

- [ ] **Step 2: Update README license section**

  Replace the current Apache-2.0 section with text stating:

  ```markdown
  AgentCore OS 当前源代码自本次许可证迁移起采用 **GNU General Public License v3.0 or later（GPL-3.0-or-later）** 开源。

  请注意：

  - **当前仓库源代码** 按 GPL-3.0-or-later 许可发布。
  - **历史上已经按 Apache-2.0 发布的版本** 继续保留原 Apache-2.0 授权边界；本次迁移不撤销既有授权。
  - **Logo、商标、产品名和品牌资产** 不默认随软件许可证一起授权，除非另有明确说明。
  - 第三方依赖仍遵循各自原有许可证。
  ```

  Keep links to `LICENSE`, `NOTICE`, and add `docs/LICENSE_CHANGE_NOTICE.md`.

- [ ] **Step 3: Update NOTICE**

  Replace the current source license sentence with:

  ```text
  Source code in this repository is licensed under the GNU General Public
  License version 3 or later (GPL-3.0-or-later) from the license migration
  commit onward.
  ```

  Add one sentence preserving old Apache-2.0 releases.

- [ ] **Step 4: Create license change notice**

  Create `docs/LICENSE_CHANGE_NOTICE.md` with sections:

  - `Current License`
  - `Effective Boundary`
  - `Historical Apache-2.0 Boundary`
  - `Brand And Trademark Boundary`
  - `Third-Party Dependencies`
  - `Contributor / Owner Review`
  - `GPLv3 Text Source`

## Task 3: Update Release Checklist And Changelog

**Files:**
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update open-source checklist**

  Under license and policy docs, add checks for:

  - `package.json` license is `GPL-3.0-or-later`,
  - README badge matches GPLv3+,
  - NOTICE uses GPL-3.0-or-later,
  - `docs/LICENSE_CHANGE_NOTICE.md` exists,
  - release notes mention the historical Apache-2.0 boundary when relevant.

- [ ] **Step 2: Update changelog**

  Under `## Unreleased`, add:

  ```markdown
  ### License Migration

  - Changed current repository source license metadata from Apache-2.0 to GPL-3.0-or-later.
  - Added a license change notice preserving the historical Apache-2.0 boundary for previously published versions.
  - Updated README, NOTICE, package metadata, and open-source release checklist to reflect the new license.
  ```

## Task 4: Verification And Commit

**Files:**
- Verify all migration files.

- [ ] **Step 1: Search old and new license references**

  Run:

  ```bash
  rg -n "Apache-2.0|Apache License 2.0|Apache_2.0" README.md NOTICE package.json docs LICENSE
  rg -n "GPL-3.0-or-later|GNU General Public License|GPLv3|GPL v3" README.md NOTICE package.json docs LICENSE
  ```

  Expected:

  - Apache references remain only in historical boundary / compatibility / migration notes.
  - Current metadata and public license sections point to GPL-3.0-or-later.

- [ ] **Step 2: Run whitespace and runtime smoke checks**

  Run:

  ```bash
  git diff --check
  npm run trace:fixtures --silent
  npm run test:controlled-runtime
  ```

  Expected:

  - `git diff --check` exits 0.
  - fixture catalog reports `ok: true`.
  - controlled runtime tests pass.

- [ ] **Step 3: Stage and commit migration**

  Run:

  ```bash
  git add LICENSE package.json package-lock.json README.md NOTICE docs/OPEN_SOURCE_CHECKLIST.md docs/LICENSE_CHANGE_NOTICE.md CHANGELOG.md docs/superpowers/specs/2026-07-06-gplv3-license-migration-design.md docs/superpowers/plans/2026-07-06-gplv3-license-migration.md
  git commit -m "docs: migrate project license to gplv3"
  ```

- [ ] **Step 4: Final status**

  Run:

  ```bash
  git status --short
  ```

  Expected:

  - no unstaged tracked project changes from this migration,
  - unrelated local untracked files may remain untouched.
