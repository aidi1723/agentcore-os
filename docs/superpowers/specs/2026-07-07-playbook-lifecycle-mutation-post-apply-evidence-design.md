# Playbook Lifecycle Mutation Post-Apply Evidence Design

Date: 2026-07-07

## Goal

Validate recorded post-apply audit evidence after a lifecycle mutation executor apply.

The previous gate declares the required post-apply command order. This gate proves maintainers recorded that exact order as green before fixture refresh, release handoff, publishing, or readiness claims.

## Scope

- Add a read-only post-apply evidence checker.
- Read one local evidence JSON file.
- Reuse the post-apply sequence checker for the referenced sequence.
- Require command evidence for the exact sequence commands:
  - `npm run playbook:control:audit`
  - `npm run playbook:lifecycle:handoff`
  - `npm run trace:fixtures --silent`
  - `npm run trace:fixtures:summary --silent`
  - `npm run test:controlled-runtime`
  - `npm run test:core-workflows`
  - `git diff --check`
- Require every command result to record `ok: true`, `exitCode: 0`, and `recordedAt`.
- Require evidence metadata for control audit, lifecycle handoff, fixture gate, fixture summary, controlled-runtime counts, core workflow gate, and git diff check.
- Require the evidence boundary to keep fixture refresh, store writes, external writes, publishing, and production readiness false.

## Non-Goals

- Execute the recorded commands.
- Refresh governed fixtures.
- Write stores or business assets.
- Call external connectors.
- Publish, tag, upload, or package artifacts.
- Claim production readiness.

## Next Gate

After this evidence gate is green, the next phase can define a fixture refresh handoff gate. That handoff must still be separate from publishing and production readiness.
