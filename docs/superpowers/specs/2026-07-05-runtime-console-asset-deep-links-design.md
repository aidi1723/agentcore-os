# Runtime Console Asset Deep Links Design

## Goal

Turn Runtime Console asset landings from receipt text into structured, filterable, clickable business destinations for controlled `sales-pipeline-v1` runs.

## Scope

In scope:

- Add structured asset metadata to controlled writeback receipts.
- Surface asset id, source key, workflow run id, and target app on controlled run console summaries.
- Extend Runtime Console text search so asset ids and receipt summaries are searchable.
- Add Runtime Console actions that open the relevant business surface:
  - `sales_asset` -> Deal Desk with workflow context.
  - `knowledge_asset` -> Knowledge Vault with an asset-id query.
- Keep existing receipt summaries for backward compatibility and human readability.

Out of scope:

- Failed step retry controls.
- New route-level asset detail APIs.
- A new global router or URL scheme.
- Editing CRM or Knowledge Vault records from Runtime Console.
- Migrating historical receipts that only contain summary text.

## Design

### Receipt Metadata

Extend `ControlledWritebackReceipt` with optional fields:

```ts
type ControlledWritebackReceipt = {
  target: string;
  ok: boolean;
  summary: string;
  writtenAt: number;
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
};
```

`writeControlledStepAssets` should populate:

- `sales_asset`: `assetId = stored.id`, `workflowRunId = stored.workflowRunId`
- `knowledge_asset`: `assetId = stored.id`, `sourceKey = stored.sourceKey`, `workflowRunId = stored.workflowRunId`

Skipped or failed receipts may omit asset metadata.

### Console Summary

Extend `ControlledRunAssetLandingSummary`:

```ts
type ControlledRunAssetLandingSummary = {
  target: string;
  label: string;
  detail: string;
  ok: boolean;
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
  appId?: "deal_desk" | "knowledge_vault";
};
```

Mapping:

- `sales_asset` -> `Deal Desk`, app id `deal_desk`
- `knowledge_asset` -> `Knowledge Vault`, app id `knowledge_vault`

The summary helper remains pure: it derives link metadata but does not dispatch UI events.

### Filtering

`filterControlledRunConsoleSummaries` should include these fields in query matching:

- run id,
- title,
- workflowRunId,
- playbookId,
- scenarioId,
- currentStepId,
- run error,
- asset target,
- asset label,
- asset id,
- asset source key,
- asset detail / receipt summary.

This gives operators a direct way to paste an asset id and find the controlled run that produced it.

### Runtime Console UI

In `受控运行 Trace`:

- Show structured asset id/source key/workflow id under each asset landing when available.
- Show an `打开` action on successful landings with an `appId`.
- For sales assets, call:

```ts
requestOpenDealDesk({
  workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary.workflowRunId,
  workflowScenarioId: selectedControlledRunSummary.scenarioId,
  workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
});
```

- For knowledge assets, call:

```ts
requestOpenKnowledgeVault({
  query: asset.assetId ?? asset.sourceKey ?? asset.detail,
});
```

Failed or skipped receipts remain visible but do not get an open action.

## Error Handling

- Missing asset metadata should not break old runs; show the receipt summary only.
- Open actions do not mutate runtime state.
- If an app cannot use the prefill deeply yet, it still opens with enough context for manual lookup.

## Testing

Add focused tests for:

- `writeControlledStepAssets` receipt metadata for sales and knowledge asset writes.
- `buildControlledRunConsoleSummary` asset landing metadata and app id mapping.
- `filterControlledRunConsoleSummaries` matching asset id/source key/receipt detail.

Existing UI behavior is exercised by build/lint and the controlled runtime regression. No backend API contract changes are required beyond the extended optional receipt fields.

## Success Criteria

- New controlled writeback receipts contain structured asset metadata.
- Runtime Console shows asset ids for sales and knowledge landings.
- Operators can search recent controlled runs by asset id or source key.
- Operators can open Deal Desk or Knowledge Vault from a successful asset landing.
- Full verification passes.
