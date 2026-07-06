# Runtime Console Delivery Readiness Audit Design

## Status

Approved design for the next documentation-first delivery checkpoint.

## Context

The project now presents the home screen as a controlled playbook cockpit. The next risk is not missing backend primitives; it is whether a maintainer or demo operator can treat Runtime Console as the primary product surface instead of a development/debug window.

Runtime Console already contains:

- runtime and sidecar diagnostics;
- controlled run list, state filter, and text search;
- selected run details;
- approval, reject, resume, and retry actions;
- governed trace copy;
- asset landing inspection and app jumps;
- core state sync status.

The project needs a delivery-readiness audit before adding more playbooks or replay behavior.

## Goal

Create a delivery-readiness audit that states what is presentable now, what remains a blocker, what should be deferred, and which verification gates must pass before the current branch can be called a controlled playbook product demo.

## Non-Goals

- Do not add real replay.
- Do not add new playbooks.
- Do not change Runtime Console behavior in this phase.
- Do not redesign the UI.
- Do not add new API routes, stores, or runtime actions.
- Do not treat this audit as a replacement for tests.

## Audit Scope

The audit must cover:

1. Entry path: Home cockpit to Runtime Console.
2. Run inspection: run list, state filters, search, selected run detail, step trace.
3. Human control: approve, reject, resume, retry.
4. Governance: governed trace copy, fixture/replay boundary visibility, raw trace exclusion.
5. Asset landings: sales, support, knowledge, workflow, and draft inspection paths.
6. Runtime health: local runtime readiness, sidecar/diagnostics, sync status.
7. Demo story: what a user should do from first screen to artifact review.
8. Delivery blockers: issues that should stop a release/demo.
9. Deferred work: items that are useful but not required for current delivery.

## Deliverables

- Add `docs/RUNTIME_CONSOLE_DELIVERY_READINESS_AUDIT.zh-CN.md`.
- Link it from `docs/DOCUMENTATION_INDEX.zh-CN.md`.
- Record it in `docs/NEXT_STEPS.md`, `docs/ROADMAP.md`, and `CHANGELOG.md`.
- Add a phase implementation plan under `docs/superpowers/plans/`.

## Acceptance Criteria

- A maintainer can read the audit and understand the current deliverable story.
- The audit distinguishes ready, blocker, and deferred items.
- The next engineering phase is explicit and does not drift into real replay or generic shell work.
- Verification evidence includes at least docs whitespace checks plus the controlled-runtime/build gates already run for the UI reframing phase.
