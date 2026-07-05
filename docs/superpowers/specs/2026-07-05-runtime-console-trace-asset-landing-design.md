# Runtime Console Trace And Asset Landing Design

## Goal

Make the existing Runtime Console show controlled run trace, approval state, writeback receipts, and concrete asset landing signals for `sales-pipeline-v1` runs.

## Scope

In scope:

- Add a controlled run list endpoint under the existing runtime executor API.
- Add a small client-side summary model for controlled run detail display.
- Add a Runtime Console panel that lists recent controlled runs and shows the selected run's steps, approval decisions, writeback receipts, and asset landing identifiers.
- Keep the visual style aligned with `DESIGN.md`: dense operational cockpit, restrained panels, semantic status labels, no new app shell.

Out of scope:

- Full Runtime Console redesign.
- New navigation, windows, or landing pages.
- Editing runs or approvals from this panel.
- Deep clickable cross-app routing beyond stable asset identifiers in this slice.
- Wiring `workflow_run` and `draft` writeback stores.

## Design

### API

Create `GET /api/runtime/executor/controlled-runs`.

The route returns recent controlled runs from `listControlledExecutionRuns()`:

```ts
{ ok: true, data: { runs: ControlledExecutionRunRecord[] } }
```

It uses the same local API authorization boundary and no-store cache semantics as executor session routes.

### Summary Model

Create a focused client-safe helper:

```ts
buildControlledRunConsoleSummary(run)
```

The helper converts a durable controlled run into:

- stable run metadata,
- counts for completed / awaiting approval / failed steps,
- approval count,
- writeback receipt count,
- concrete asset landing labels from `sales_asset` and `knowledge_asset` receipts,
- ordered step summaries with status, approval state, validation state, and receipt summaries.

This keeps display logic testable without rendering the large console component.

### Runtime Console UI

Add a new panel to `ClawRuntimeConsoleAppWindow` near executor history:

- left column: recent controlled runs with playbook, state, current step, updated time,
- right column: selected run detail with run metadata, step trace, approval decisions, schema validation, and writeback receipts.

The panel should use existing button/panel/badge patterns and the current white/gray operational cockpit surface. It must not introduce a new design language or large visual overhaul.

### Error States

The panel handles:

- list loading,
- list error,
- empty list,
- detail loading,
- stale selection after refresh.

### Testing

Add focused tests:

- API list route returns recent controlled runs.
- summary model exposes step, approval, writeback, and asset landing signals.
- existing controlled runtime regression remains green.

## Success Criteria

- A completed controlled sales run is visible in Runtime Console.
- The selected run shows each step, approval decisions, and writeback receipts.
- Sales and knowledge writeback receipts surface concrete landing labels.
- Existing executor session history remains unchanged.
- `npm run test:controlled-runtime`, `npm run test:core-workflows`, `npm run lint`, and `npm run build` pass.
