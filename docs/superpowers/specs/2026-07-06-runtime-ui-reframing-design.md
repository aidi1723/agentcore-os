# Runtime UI Reframing Design

## Status

Approved working design for the next delivery slice.

## Context

The project direction has moved from an AI OS shell toward a Controlled Skill / Playbook Runtime. The backend now emphasizes fixed playbooks, approval boundaries, durable trace, governed artifacts, replay gates, and asset writeback.

The current UI still exposes some of the old shell mental model: departments, app windows, role desks, and agent chat. Those pieces remain useful, but the first screen should now communicate the runtime model first:

- what playbook can run;
- what is running or blocked;
- what needs approval;
- what asset/replay gates prove safety;
- where to recover or inspect the run.

## Goal

Reframe the first viewport from an app launcher / chat desk into a runtime-first controlled playbook cockpit.

## Non-Goals

- Do not redesign every app window.
- Do not remove the desktop shell.
- Do not change business app behavior.
- Do not add new runtime backend features.
- Do not call live controlled-run APIs from the home screen.
- Do not integrate real replay into UI.
- Do not add decorative landing-page styling.

## Design Direction

The UI should follow `DESIGN.md`:

- restrained operational cockpit;
- dense but organized information;
- stable grid tracks;
- clear runtime state;
- semantic status colors;
- primary actions that start, continue, inspect, approve, or recover work.

The first slice should not be a visual skin change. It should change the information hierarchy.

## First Delivery Slice

Add a runtime cockpit summary model to the existing home command center layer.

The summary should expose:

- title: `Controlled Playbook Cockpit` / localized equivalents;
- subtitle: selected playbook / scenario context;
- primary metric: current playbook run state;
- approvals metric: pending human review count;
- recovery metric: failed/retryable workflow count;
- governance metric: governed trace / replay gate status;
- primary action label: open Runtime Console;
- secondary action label: start/continue controlled playbook.

Use the summary in `SolutionCenterPanel` and `CommandCenterSidebar` so the first viewport reads as a controlled runtime surface before it reads as chat or an app list.

## Architecture

Add a pure helper in `src/lib/home-command-center.ts`:

```ts
buildRuntimeCockpitSummary({
  runtimeReady,
  runtimeLabel,
  scenarioTitle,
  workflowTitle,
  selectedRunState,
  pendingApprovalCount,
  runningCount,
  failedCount,
  language,
})
```

The helper returns localized copy and metrics. `SolutionCenterPanel` computes the same counts it already has, then passes the summary into `CommandCenterSidebar`.

No persistent data changes are needed.

## Tests

Add unit tests for the pure helper:

- English copy names the cockpit as `Controlled Playbook Cockpit`.
- Runtime/gate metric is success when runtime is ready.
- Runtime/gate metric is warning when runtime is not ready.
- Pending approvals and failures use warning/danger tones.

Targeted verification:

```bash
npm test -- src/__tests__/lib/home-command-center.test.ts
```

Broader verification:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
```

## Acceptance Criteria

- Home helper has a tested runtime cockpit summary.
- First viewport copy prioritizes controlled playbook execution over generic app/chat language.
- Runtime Console is visible as the primary inspection action.
- Existing app windows and workflow launch behavior still work.
- No route/store/tool/replay behavior changes are introduced.
