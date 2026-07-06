# Public Release Guide

This document defines the public release boundary for the current AgentCore OS repository.

## Current Public Position

Current recommended public evaluation line: `v1.3.0`.

Current delivery status:

- local delivery demo ready;
- production readiness is not claimed;
- packaged desktop installers are not the default distribution promise;
- real replay and external system writes are outside the current release claim.

AgentCore OS should now be described as a local-first Controlled Skill / Playbook Runtime for fixed skill/playbook workflows with durable approvals, trace governance, recovery, and approved asset writeback.

The current branch is suitable for local evaluation and delivery demos. It should not be described as production ready until production operations, real replay boundaries, long-term retention operations, and external integration guarantees are separately implemented and verified.

## Public Release Boundary

The public repository should present:

- AgentCore OS as the product name and public project identity;
- Controlled Skill / Playbook Runtime as the current engineering core;
- Runtime Console as the operator surface for controlled runs, approvals, recovery, asset landings, and governed trace export;
- `sales-pipeline-v1` and `support-resolution-v1` as the currently covered controlled playbooks;
- local demo readiness through deterministic seed/check data, governed fixture gates, retention preview, and browser evidence;
- command-line install / source run as the recommended evaluation path.

The public repository should not claim:

- production readiness;
- real LLM/tool replay;
- automated fixture refresh;
- external system writes during replay;
- DMG / EXE installer distribution as the default path;
- complete removal of all historical compatibility names.

## Fast Local Readiness Gate

Use the fast local readiness gate before public demos or release sanity checks:

```bash
npm run delivery:ready:check
```

This command aggregates:

- `npm run delivery:demo:check`;
- `npm run trace:fixtures --silent`;
- `npm run trace:fixtures:summary --silent`;
- `npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20`.

Successful output must include:

```json
{
  "releaseClaim": "local_delivery_demo_ready",
  "productionReady": false
}
```

This gate does not replace full regression, lint, build, or manual browser smoke.

## Full Verification

Before a public release announcement or handoff, run:

```bash
npm run delivery:ready:check
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Manual browser evidence remains separate:

- seed demo data if needed;
- open Home;
- open Runtime Console;
- inspect `delivery-demo-run-completed`;
- confirm sales / knowledge / workflow / draft / support asset landings;
- copy governed trace artifact.

Current browser evidence is documented in:

- `docs/BROWSER_EVIDENCE_AND_RELEASE_READINESS_SWEEP.zh-CN.md`
- `docs/RUNTIME_UI_DELIVERY_POLISH_CLOSEOUT.zh-CN.md`

## Compatibility Notes

Some historical names remain as compatibility details. These are not the current public positioning.

Compatibility that may still appear in code or docs:

- `.openclaw-data` as the local data directory;
- selected `openclaw.*` local/browser state migration paths;
- legacy route or file names that still exist until runtime-named replacements are fully complete;
- historical release notes that mention OpenClaw-era migration.

When these terms appear in public docs, they should be framed as compatibility or history, not as the current product identity.

## Distribution Guidance

Recommended public entry points:

- GitHub repository: <https://github.com/aidi1723/agentcore-os>
- CNB mirror: <https://cnb.cool/aidiyangyu/agentcore-os>
- GitHub Releases: <https://github.com/aidi1723/agentcore-os/releases>

Recommended evaluation path:

```bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
```

For Chinese readers, prefer:

- `docs/EARLY_ACCESS_RELEASE.zh-CN.md`
- `docs/COMMAND_LINE_INSTALL.zh-CN.md`
- `docs/PROJECT_FRAMEWORK.zh-CN.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/NEXT_STEPS.md`

## Public Summary

Suggested wording:

> AgentCore OS is a local-first Controlled Skill / Playbook Runtime for running fixed business workflows with durable approvals, trace governance, recovery, and approved asset writeback. The current branch is ready for local delivery demos through the Runtime Console and governed trace workflow. Production readiness, real replay, and packaged installer distribution remain outside the current release claim.
