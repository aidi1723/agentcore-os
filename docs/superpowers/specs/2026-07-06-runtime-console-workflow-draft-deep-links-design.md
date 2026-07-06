# Runtime Console Workflow And Draft Deep Links Design

## Goal

Make Runtime Console writeback landings cover the full controlled sales run output: sales asset, knowledge asset, workflow run, and draft. Operators should be able to open the workflow run or draft record from the trace without copying ids by hand.

## Scope

In scope:

- Include successful `workflow_run` and `draft` receipts in controlled run landing summaries.
- Preserve existing sales asset and knowledge asset landing behavior.
- Add Runtime Console open actions for `workflow_run` and `draft`.
- Add a narrow workflow-run focus prefill for the existing Industry Hub workflow surface.
- Reuse the existing Publisher `draftId` prefill path for draft records.
- Add regression coverage for summary mapping, search, and Runtime Console open actions.
- Update changelog, next steps, controlled runtime manual, and local memory after implementation.

Out of scope:

- New pages, routes, or app windows.
- New editing behavior for workflow runs or drafts.
- Historical receipt migration.
- Changes to writeback persistence.
- Generic landing registry beyond the four current controlled sales targets.

## Current Behavior

`buildControlledRunConsoleSummary` currently turns only these receipt targets into `assetLandings`:

- `sales_asset` -> Deal Desk
- `knowledge_asset` -> Knowledge Vault

`workflow_run` and `draft` receipts remain visible in step-level receipt lists and searchable through generic receipt text, but they do not appear as first-class landings and cannot be opened from the Runtime Console asset landing panel.

## Design

### Landing Model

Extend `ControlledRunAssetLandingSummary` to support four target apps:

```ts
appId?: "deal_desk" | "knowledge_vault" | "industry_hub" | "publisher";
```

Labels:

- `sales_asset`: `Sales asset`
- `knowledge_asset`: `Knowledge asset`
- `workflow_run`: `Workflow run`
- `draft`: `Draft`

App ids:

- `sales_asset`: `deal_desk`
- `knowledge_asset`: `knowledge_vault`
- `workflow_run`: `industry_hub`
- `draft`: `publisher`

Landing inclusion rule:

- Include the four controlled sales targets above.
- Preserve `ok` state and receipt detail.
- The open button remains visible only when `ok === true` and `appId` exists.
- Failed or skipped receipts can still be shown but are not openable.

### Workflow Run Open Action

Add an Industry Hub prefill contract:

```ts
export type IndustryHubPrefill = {
  workflowRunId?: string;
  scenarioId?: string;
};
```

Add `requestOpenIndustryHub(prefill?: IndustryHubPrefill)` in `src/lib/ui-events.ts`.

`dispatchOpenAppPrefill` should dispatch:

```txt
openclaw:industry-hub-prefill
```

when opening `industry_hub`.

`IndustryHubAppWindow` should listen for this event and, when it receives a `workflowRunId`:

- hydrate its existing workflow run list from local/server-backed state as it already does,
- find the matching workflow run,
- select the role/scenario that owns the matching run when it can be resolved,
- show a concise toast confirming focus,
- avoid creating a new workflow run if the id is missing or not found.

The focus is intentionally lightweight. The existing Industry Hub workflow map remains the visible workflow surface.

### Draft Open Action

Use the existing Publisher prefill path:

```ts
requestOpenPublisher({
  draftId: asset.assetId,
  workflowRunId: asset.workflowRunId,
  workflowScenarioId: selectedControlledRunSummary?.scenarioId,
  workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
  workflowNextStep: "Review the controlled run draft and decide whether to publish or revise.",
});
```

Publisher already resolves `draftId` and copies workflow context from the stored draft when available. No Publisher UI redesign is needed.

### Runtime Console UI

Keep the existing `Asset landings` panel:

- It will now show workflow and draft landings alongside sales and knowledge landings.
- Metadata rows stay the same: `Asset`, `Source`, `Workflow`.
- The same `打开` action is used for all openable landing types.
- No new visual section is needed. This preserves the restrained operational cockpit layout in `DESIGN.md`.

### Search

Existing search already indexes `assetLandings` and raw receipt fields. After `workflow_run` and `draft` become asset landings, search must continue to match:

- `workflowRunId`
- `draft` asset id
- receipt `sourceKey`
- target labels such as `Draft` and `Workflow run`

### Error Handling

- If a landing has no required id, the open action should not throw.
- For workflow run landing without a `workflowRunId`, fall back to the selected controlled run `workflowRunId`.
- For draft landing without `assetId`, use a toast error and do not open Publisher.
- Existing sales/knowledge fallback behavior remains unchanged, including broad Deal Desk fallback for legacy sales receipts without structured record metadata.

## Testing

Add or update tests:

- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
  - Summary includes workflow run and draft landings with `industry_hub` and `publisher` app ids.
  - Search matches draft id and workflow id through asset landings.

- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
  - Clicking a workflow run landing calls `requestOpenIndustryHub` with `workflowRunId` and `scenarioId`.
  - Clicking a draft landing calls `requestOpenPublisher` with `draftId`, `workflowRunId`, and workflow context.
  - Existing sales/knowledge landing tests remain green.

- `src/__tests__/components/IndustryHubAppWindow.test.tsx` if the existing test harness supports it without excessive setup.
  - Industry Hub focuses an existing workflow run from `openclaw:industry-hub-prefill`.
  - If this is too heavy for the slice, cover the prefill dispatch contract in `ui-events` / Runtime Console tests and keep Industry Hub listener implementation simple.

Verification gates:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

## Success Criteria

- Runtime Console shows successful `workflow_run` and `draft` receipts in the same landing panel as sales/knowledge assets.
- Workflow run landing opens Industry Hub with the matching workflow run context.
- Draft landing opens Publisher with the matching draft selected.
- Search finds runs by workflow run id, draft id, source key, and landing labels.
- Existing sales/knowledge landing behavior is unchanged.
- Full verification passes with only the known `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

## Design Notes

- This keeps the Runtime Console as a trace and navigation surface, not an editor.
- This avoids a new workflow-run detail page until the controlled runtime has more than one migrated playbook.
- This fits the `DESIGN.md` operational cockpit contract: same dense panel, same restrained action button, same trace-to-record path.
