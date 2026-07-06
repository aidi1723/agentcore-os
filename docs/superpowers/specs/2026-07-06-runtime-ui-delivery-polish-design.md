# Runtime UI Delivery Polish Design

Approved working design for the next UI delivery slice.

## Context

AgentCore OS is no longer being optimized as a generic desktop shell. The current product center is a Controlled Skill / Playbook Runtime: fixed playbooks, approval gates, durable trace, retry / resume, governed trace artifacts, and approved asset writeback.

The previous Runtime UI Reframing made Home point users toward a controlled playbook cockpit. The current branch is local delivery demo ready, but the Runtime Console still reads too much like a mixed runtime/debug screen. The next UI work should make the delivery path easier to scan without changing execution behavior.

## Goal

Make the first delivery path clearer:

1. Home remains the controlled playbook cockpit and keeps Runtime Console as the primary inspection action.
2. Runtime Console clearly summarizes delivery readiness before the operator reads individual trace details.
3. Operators can quickly see whether the current recent runs include completed handoff evidence, pending approvals, retryable failures, asset landings, and governed trace copy candidates.

## Non-Goals

- Do not redesign the whole desktop shell.
- Do not introduce a new component library or visual system.
- Do not change routing, app window behavior, playbook execution, approval semantics, writeback, trace governance, or replay contracts.
- Do not present local delivery demo readiness as production readiness.
- Do not add decorative hero sections, OS-shell flourishes, or marketing visuals.

## Design Direction

Use the existing `DESIGN.md` operational cockpit style:

- dense but organized;
- 6px to 8px panel radius where practical;
- semantic status colors;
- compact headings;
- visible next actions;
- stable cards and grids;
- no broad visual drama.

The closest implementation base remains the existing source-owned React / Tailwind component layer. The repo does not need Refine, shadcn/ui, HeroUI, or a separate admin template for this slice.

## Runtime Console Delivery Summary

Add a pure summary helper in `src/lib/executor/runtime/console-summary.ts`.

The helper consumes `ControlledRunConsoleSummary[]` and returns:

- total recent controlled runs;
- completed runs;
- runs awaiting approval;
- retryable failed runs;
- successful asset landings;
- completed runs that can produce governed trace artifacts;
- a compact status label and detail message.

Status rules:

- `Action required` when there are pending approvals or retryable failures.
- `Delivery evidence ready` when at least one completed run has successful asset landings.
- `Trace ready` when there is a completed run but no asset landing evidence.
- `No runs` when there are no recent controlled runs.
- `In progress` for non-empty recent runs without completed evidence or action-required states.

## Runtime Console UI

Add a compact delivery handoff band above the controlled run filter bar:

- left side: status label and one-line detail;
- metric cells: recent runs, pending approvals, retryable failures, asset landings, governed trace candidates;
- keep the existing run list, search, state filters, selected detail, action buttons, asset landing cards, and governed trace copy behavior.

This band should make the console usable for a handoff conversation without forcing the operator to inspect every selected run first.

## Home UI

No broad Home redesign in this slice.

Keep Home as currently reframed:

- controlled playbook cockpit;
- Runtime Console primary action;
- controlled playbook secondary action;
- metrics for playbook state, approvals, recovery, and governance.

Only update Home text if a failing test proves the delivery handoff language is missing or misleading.

## Testing

Add tests before implementation:

- helper test for delivery summary counts and status labels;
- Runtime Console component test proving the delivery handoff band renders status and metrics from seeded controlled runs;
- keep existing asset landing, governed trace copy, retry, and focus tests intact.

## Documentation And Records

Update after implementation:

- `CHANGELOG.md`;
- `docs/NEXT_STEPS.md`;
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`;
- `memory/2026-07-06.md`.

The next default phase after this slice should return to Trace Operations Hardening unless browser evidence reveals a UI blocker.
