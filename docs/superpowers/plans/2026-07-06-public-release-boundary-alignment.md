# Public Release Boundary Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align public release and open-source documents with the current Controlled Skill / Playbook Runtime delivery boundary.

**Architecture:** This is a documentation-only phase. Replace older v1.2.0 / legacy migration-centered public release framing with the current v1.3.0-era local delivery demo readiness framing, while preserving historical references where useful.

**Tech Stack:** Markdown documentation, existing npm verification commands, ripgrep scans.

---

## Files

- Modify: `docs/PUBLIC_RELEASE.md`
- Modify: `docs/PUBLIC_RELEASE.zh-CN.md`
- Modify: `docs/EARLY_ACCESS_RELEASE.zh-CN.md`
- Modify: `docs/OPEN_SOURCE_CHECKLIST.md`
- Modify: `README.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `CHANGELOG.md`
- Modify: `memory/2026-07-06.md`

## Task 1: Rewrite Public Release Boundary Docs

- [x] Update `docs/PUBLIC_RELEASE.md`.

Replace the older v1.2.0-centered public release boundary with:

```md
# Public Release Guide

This document defines the public release boundary for the current AgentCore OS
repository.

## Current Public Position

Current recommended public evaluation line: `v1.3.0`.

Current delivery status:

- local delivery demo ready;
- production readiness is not claimed;
- packaged desktop installers are not the default distribution promise;
- real replay and external system writes are outside the current release claim.

AgentCore OS should now be described as a local-first Controlled Skill /
Playbook Runtime for fixed skill/playbook workflows with durable approvals,
trace governance, recovery, and approved asset writeback.
```

- [x] Ensure `docs/PUBLIC_RELEASE.md` mentions:

```bash
npm run delivery:ready:check
```

as the fast local delivery readiness gate, and also keeps full verification separate:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

- [x] Preserve legacy `.openclaw-data` / `OpenClaw` references only as compatibility or history notes, not as the current public positioning.

- [x] Update `docs/PUBLIC_RELEASE.zh-CN.md` with the Chinese equivalent:

```md
当前推荐公开评估版本：`v1.3.0`

当前交付状态：

- 可以声明 local delivery demo ready；
- 不声明 production ready；
- 不把 DMG / EXE 安装包作为默认分发承诺；
- 真实 replay、外部系统写入和生产级运维边界仍不属于当前公开声明。
```

- [x] Update `docs/EARLY_ACCESS_RELEASE.zh-CN.md` so the “当前对外口径” section includes:

```md
- 当前工程主线：Controlled Skill / Playbook Runtime
- 当前交付状态：local delivery demo ready
- 快速本地交付门禁：`npm run delivery:ready:check`
- 不声明 production ready
```

## Task 2: Update Open Source Checklist And README

- [x] Update `docs/OPEN_SOURCE_CHECKLIST.md` final verification section to include:

```bash
npm run delivery:ready:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git status
```

- [x] Add an explicit checklist item:

```md
- public docs say local delivery demo ready, not production ready
```

- [x] Update `README.md` only in the scripts / verification section. Add:

```md
- `npm run delivery:ready:check`：快速本地交付门禁，聚合 demo check、governed fixture、fixture summary 和 retention preview，只声明 `local_delivery_demo_ready`
```

- [x] Do not otherwise rewrite README positioning because it already states Controlled Skill / Playbook Runtime and not production ready.

## Task 3: Backlog, Changelog, And Memory Records

- [x] Update `docs/NEXT_STEPS.md` completed baseline with:

```md
- Public Release Boundary Alignment: public release and open-source docs now describe the current Controlled Skill / Playbook Runtime boundary, local delivery demo readiness, and the `delivery:ready:check` gate without claiming production readiness.
```

- [x] Add a completed section to `docs/NEXT_STEPS.md`:

```md
## Completed. Public Release Boundary Alignment

- Aligned public release docs around `v1.3.0` and Controlled Skill / Playbook Runtime.
- Replaced old v1.2.0-only public recommendation wording with current local delivery demo readiness wording.
- Added `delivery:ready:check` to public release sanity checks.
- Kept production readiness, real replay, external writes, and packaged installers outside the current release claim.
```

- [x] Update `CHANGELOG.md` under Unreleased:

```md
### Public Release Boundary Alignment

- Aligned public release and open-source checklist docs with the current Controlled Skill / Playbook Runtime direction.
- Documented `npm run delivery:ready:check` as the fast local delivery readiness gate while keeping production readiness out of scope.
```

- [x] Update `memory/2026-07-06.md` with the phase record.

## Task 4: Verification

- [x] Run the wording scan:

```bash
rg -n "v1\\.2\\.0|production ready|production-ready|OpenClaw|AI OS shell|delivery:ready:check|local_delivery_demo_ready" README.md docs/PUBLIC_RELEASE.md docs/PUBLIC_RELEASE.zh-CN.md docs/EARLY_ACCESS_RELEASE.zh-CN.md docs/OPEN_SOURCE_CHECKLIST.md docs/NEXT_STEPS.md CHANGELOG.md
```

Expected:

- `v1.2.0` appears only as a historical/previous-version reference.
- `OpenClaw` appears only as compatibility/history language.
- `production ready` appears only in negative boundary language.
- `delivery:ready:check` appears in public release sanity docs.

Result: passed review. Remaining `v1.2.0` references are previous-version or historical changelog references; remaining `OpenClaw` references are compatibility/history references; `production ready` appears only as a negative boundary.

- [x] Run:

```bash
npm run delivery:ready:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- all commands exit 0;
- lint/build may keep the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

Result:

- `npm run delivery:ready:check` — exit 0; output `releaseClaim: "local_delivery_demo_ready"` and `productionReady: false`.
- `npm run test:controlled-runtime` — 41 files / 210 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.

## Task 5: Commit And Push

- [ ] Stage only current phase files:

```bash
git add \
  CHANGELOG.md \
  README.md \
  docs/EARLY_ACCESS_RELEASE.zh-CN.md \
  docs/NEXT_STEPS.md \
  docs/OPEN_SOURCE_CHECKLIST.md \
  docs/PUBLIC_RELEASE.md \
  docs/PUBLIC_RELEASE.zh-CN.md \
  docs/superpowers/plans/2026-07-06-public-release-boundary-alignment.md \
  memory/2026-07-06.md
```

- [ ] Commit:

```bash
git commit -m "docs: align public release boundary"
```

- [ ] Push:

```bash
git push origin main
```
