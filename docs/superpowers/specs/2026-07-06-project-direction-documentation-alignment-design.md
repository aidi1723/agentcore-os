# Project Direction Documentation Alignment Design

## Context

AgentCore OS has moved from a broad AI OS shell into a Controlled Skill / Playbook Runtime. The current runtime line has progressed past the first sales playbook, support playbook migration, Runtime Console recovery, governed trace artifacts, fixture generation, fixture replay, catalog reporting, fixture CI gates, fixture refresh review, catalog coverage review, and the governed trace operational runbook.

Some entry documents still describe earlier gaps as pending. That creates a drift risk: future work may restart already completed phases or move back toward generic app-shell expansion, a generic skill collection, or open-ended agent orchestration.

## Goal

Align the project direction documents so the next engineering sessions start from the same source of truth:

- current project north star: Controlled Skill / Playbook Runtime,
- completed baseline through Phase 10u Trace Governance Operational Runbook,
- next default phase: Phase 10v Real Replay Boundary Design,
- guardrail: do not expand generic OS shell, generic skill marketplace, or open-ended agent orchestration before controlled replay boundaries are designed.

## Scope

Update documentation only. No runtime behavior, UI behavior, fixture JSON, test logic, route logic, or package scripts change in this phase.

Primary documents:

- `README.md`
- `docs/PROJECT_FRAMEWORK.zh-CN.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/DOCUMENTATION_INDEX.zh-CN.md`
- `docs/NEXT_STEPS.md`
- `CHANGELOG.md`

The controlled runtime manual is already mostly current and should only be touched if a direct link or direction note is needed.

## Direction Contract

The aligned docs must make these decisions explicit:

1. Public `v1.3.0` remains the stable release-facing baseline.
2. Current `main` engineering work is the controlled runtime branch, not a generic AI OS expansion.
3. Existing desktop shell, app windows, Deal Desk, Support Copilot, Knowledge Vault, Industry Hub, and Publisher are business/operation surfaces around the runtime.
4. Runtime truth lives in playbooks, durable controlled runs, approvals, governed trace artifacts, fixture replay, and writeback receipts.
5. Real replay is not implemented yet. The next phase must design sandbox, credentials, approval simulation, store isolation, side-effect blocking, and result ownership before any real tool replay code is added.

## Required Alignment

### README

Clarify the split between:

- stable public product line, and
- current engineering direction on `main`.

The first-screen project description should still be understandable to release readers, but the recommended engineering docs should point maintainers to the framework, runtime manual, Next Steps, and governed trace operational runbook.

### Project Framework

Refresh current state from early controlled runtime to the completed Phase 10u baseline. Replace stale pending items with the actual remaining boundary:

- fixture replay is metadata-only,
- real LLM/tool replay has not been designed,
- Phase 10v must be design-first.

### Roadmap

Replace the old near-term P0-P4 list with the current roadmap:

- P0 Real Replay Boundary Design,
- P1 no-side-effect replay sandbox prototype only after P0,
- P2 additional playbook or fixture expansion only when governed trace/replay gates remain stable,
- P3 operational retention/maintenance hardening,
- P4 later app or shell polish only when it serves runtime operation.

### Architecture

Update runtime modules and writeback support to include:

- `sales-pipeline-v1`,
- `support-resolution-v1`,
- workflow/draft/support writeback,
- trace governance,
- fixture replay/catalog/report/summary commands,
- real replay boundary not implemented.

### Documentation Index And Next Steps

Make the recommended reading path and current backlog point to the same branch:

- Project Framework,
- Controlled Runtime Manual,
- Next Steps,
- Roadmap,
- Governed Trace Operational Runbook,
- Fixture CI Gates,
- Fixture Replay Contract.

Next Steps should record this alignment phase and keep Phase 10v as the recommended next task.

### Changelog

Add an Unreleased entry recording this documentation alignment and its guardrail purpose.

## Out Of Scope

- No new runtime APIs.
- No real replay implementation.
- No tool execution replay.
- No fixture auto-refresh command.
- No new playbook.
- No UI redesign.
- No change to stable release notes.

## Verification

Minimum verification:

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

Preferred full verification if time allows:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Known accepted warning:

- `npm run lint` and `npm run build` may show the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Success Criteria

- A maintainer can read README, Project Framework, Roadmap, Architecture, Documentation Index, or Next Steps and reach the same conclusion about current direction.
- No major entry doc still lists completed phases as future work.
- Next default phase is consistently Phase 10v Real Replay Boundary Design.
- The docs explicitly prevent drift back to generic OS shell expansion, generic skill work, or open-ended agent orchestration.
