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

## Open Source Hygiene Gate

Use the local open-source hygiene gate before public handoff or repository
presentation checks:

```bash
npm run release:hygiene:check
```

This command checks:

- required public governance docs;
- `package.json` license metadata;
- tracked build/private artifact paths;
- public release docs mentioning `delivery:ready:check`;
- public release docs avoiding positive production-ready claims.

The secret pattern review in this gate is warning-only. It reports file-level
match counts for human review and does not prove the repository has no secrets.

Successful output must include:

```json
{
  "ok": true,
  "productionReady": false
}
```

## Full Local Handoff Gate

Use the full local handoff gate when the repository is ready for a final local
handoff check:

```bash
npm run release:handoff:check
```

This command aggregates:

- `npm run release:hygiene:check`;
- `npm run delivery:ready:check`;
- `npm run test:controlled-runtime`;
- `npm run test:core-workflows`;
- `npm run lint`;
- `npm run build`;
- `git diff --check`.

Successful output must include:

```json
{
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false
}
```

This gate performs no publishing, tagging, uploading, installer packaging, or
GitHub Release creation.

## Local Handoff Evidence Snapshot

After the full local handoff gate passes, preserve a local evidence file with:

```bash
npm run release:handoff:snapshot
```

This command runs `release:handoff:check`, parses its JSON report, captures git
branch / commit / short status context, and writes a timestamped JSON snapshot
under:

```text
output/release-handoff/
```

Successful snapshot output includes:

```json
{
  "releaseClaim": "local_release_handoff_ready",
  "productionReady": false,
  "publishingPerformed": false,
  "evidenceOnly": true
}
```

Snapshots are local handoff evidence only. They are not published release
artifacts and should not be committed by default.

Validate a local snapshot before handoff review with:

```bash
npm run release:handoff:snapshot:check -- <snapshot.json>
```

The validator is read-only. It checks the snapshot schema, embedded
`release:handoff:check` report shape, and release boundary fields such as
`productionReady: false`, `publishingPerformed: false`, and
`evidenceOnly: true`.

To review recent local evidence without manually locating timestamped files,
run:

```bash
npm run release:handoff:snapshot:index -- --check --limit 5
```

The index command is read-only. It lists local snapshots newest first and can
validate the listed files; it does not create evidence, mutate evidence,
publish, upload, tag, package installers, create GitHub Releases, run browser
smoke, or claim production readiness.

Check that the newest local evidence matches the current source commit with:

```bash
npm run release:handoff:evidence:check
```

This freshness command is read-only. It validates the newest snapshot and
compares `snapshot.git.commit` with current `HEAD`. If it fails because the
snapshot is stale, rerun the handoff gate and generate a new snapshot; do not
edit evidence in place.

## Full Verification

Before a public release announcement or handoff, run:

```bash
npm run release:handoff:check
npm run release:handoff:snapshot
npm run release:handoff:snapshot:check -- <snapshot.json>
npm run release:handoff:snapshot:index -- --check --limit 5
npm run release:handoff:evidence:check
```

If the aggregate gate fails and the failed child command needs to be reproduced
directly, run the reported child command from the JSON output.

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
