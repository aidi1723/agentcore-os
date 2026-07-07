# Playbook Lifecycle Mutation Post-Apply Sequence Design

Date: 2026-07-07

## Goal

Define the required local audit sequence after a lifecycle mutation executor apply.

The gate prevents a local playbook file replacement from being treated as ready, published, or fixture-refreshable until maintainers have a declared post-apply audit order.

## Scope

- Add a read-only post-apply sequence checker.
- Validate the referenced apply report is a completed local mutation apply.
- Require the exact post-apply command order:
  - `npm run playbook:control:audit`
  - `npm run playbook:lifecycle:handoff`
  - `npm run trace:fixtures --silent`
  - `npm run trace:fixtures:summary --silent`
  - `npm run test:controlled-runtime`
  - `npm run test:core-workflows`
  - `git diff --check`
- Require policies that block fixture refresh, publishing, and production-ready claims before post-apply audit evidence exists.

## Non-Goals

- Execute the declared commands.
- Refresh governed fixtures.
- Write stores or business assets.
- Publish, tag, upload, or package artifacts.
- Claim production readiness.

## Next Gate

The next phase should add post-apply audit evidence validation. That later gate should read recorded command results and fail closed if any required post-apply command was skipped, failed, stale, or reordered.
