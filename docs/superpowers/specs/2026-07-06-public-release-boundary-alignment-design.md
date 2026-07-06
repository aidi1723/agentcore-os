# Public Release Boundary Alignment Design

Date: 2026-07-06

## Context

The runtime delivery path has changed materially since the older public release
documents were written. The current project direction is now a Controlled Skill
/ Playbook Runtime, not a generic AI OS shell expansion and not a conventional
skill collection.

The codebase also now has a fast local delivery gate:

```bash
npm run delivery:ready:check
```

That gate can support a `local_delivery_demo_ready` claim, but it explicitly
keeps `productionReady: false`. Some public release docs still describe older
release positioning, v1.2.0-era public naming cleanup, desktop packaging, or
general local-first AI workflow wording without reflecting the current
controlled runtime boundary.

## Goal

Align public-facing release and open-source documents with the current delivery
truth:

- AgentCore OS is currently centered on the Controlled Skill / Playbook Runtime.
- The branch can claim local delivery demo readiness.
- The branch must not claim production readiness.
- `npm run delivery:ready:check` is the fast local delivery readiness gate.
- Full regression, lint, build, and browser smoke remain separate evidence.
- Real replay, new playbooks, external writes, and packaged desktop installers
  remain outside the current release claim unless separately implemented and
  verified.

## Non-Goals

- No runtime code changes.
- No UI changes.
- No route changes.
- No real replay.
- No fixture refresh.
- No new playbook.
- No external system mutation.
- No release tag creation.
- No GitHub Release publishing.
- No installer packaging.
- No claim that the current branch is production ready.

## Documents To Align

Primary documents:

- `docs/PUBLIC_RELEASE.md`
- `docs/PUBLIC_RELEASE.zh-CN.md`
- `docs/EARLY_ACCESS_RELEASE.zh-CN.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`

Supporting documents:

- `README.md`
- `docs/NEXT_STEPS.md`
- `CHANGELOG.md`
- `memory/2026-07-06.md`

Only update supporting documents when the current wording conflicts with the
new release boundary or should mention the new alignment phase.

## Required Public Wording

The aligned documents should consistently communicate:

```text
Current delivery status: local delivery demo ready.
Production readiness is not claimed.
```

They should also point maintainers to:

```bash
npm run delivery:ready:check
```

as the fast local delivery readiness gate.

Recommended public positioning:

> AgentCore OS is a local-first controlled runtime for running fixed
> skill/playbook workflows with durable approvals, trace governance, recovery,
> and approved asset writeback. The current branch is ready for local delivery
> demos, with production readiness and real replay still outside the current
> release claim.

## Expected Edits

### `docs/PUBLIC_RELEASE.md`

Replace old v1.2.0 / legacy OpenClaw migration framing with the current public
boundary:

- current public evaluation line is v1.3.0-era local delivery demo readiness;
- public entry should explain Controlled Skill / Playbook Runtime;
- compatibility with legacy `.openclaw-data` may remain documented, but should
  not be the central story;
- `delivery:ready:check` belongs in release sanity;
- production readiness is explicitly not claimed.

### `docs/PUBLIC_RELEASE.zh-CN.md`

Mirror the same boundary in Chinese:

- current public claim is local delivery demo ready;
- current core is controlled playbook runtime;
- command-line/source install remains the recommended evaluation path;
- packaged installer distribution is not the default promise;
- `delivery:ready:check` is the fast local readiness gate.

### `docs/EARLY_ACCESS_RELEASE.zh-CN.md`

Update early access wording so it does not overstate stable production use.
It should position the project as suitable for local demo/evaluation and
controlled-runtime review.

### `docs/OPEN_SOURCE_CHECKLIST.md`

Add controlled runtime delivery checks:

- `npm run delivery:ready:check`;
- `npm run test:controlled-runtime`;
- `npm run test:core-workflows`;
- keep `npm run lint` and `npm run build`;
- confirm docs do not claim production readiness.

### `README.md`

If README already clearly states Controlled Skill / Playbook Runtime and
local-delivery boundaries, leave it alone. If it still implies generic AI OS
shell expansion or production release readiness, update only the affected
paragraphs.

### `docs/NEXT_STEPS.md` and `CHANGELOG.md`

Record the alignment as a documentation phase. Do not introduce new feature
claims.

## Verification

Run:

```bash
rg -n "v1\\.2\\.0|production ready|production-ready|OpenClaw|AI OS shell|delivery:ready:check|local_delivery_demo_ready" README.md docs/PUBLIC_RELEASE.md docs/PUBLIC_RELEASE.zh-CN.md docs/EARLY_ACCESS_RELEASE.zh-CN.md docs/OPEN_SOURCE_CHECKLIST.md docs/NEXT_STEPS.md CHANGELOG.md
npm run delivery:ready:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- old v1.2.0-only public recommendation is removed or clearly historical;
- remaining `OpenClaw` references are compatibility/history references, not
  current public positioning;
- public docs mention `delivery:ready:check`;
- public docs do not claim production readiness;
- all commands exit 0;
- lint/build may keep the existing `<img>` warning in
  `src/__tests__/components/ShellUI.test.tsx`.
