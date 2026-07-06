# Runtime Console Record-Level Asset Focus Design

## Goal

Make Runtime Console asset landings open the exact retained business record produced by a controlled run, not only the destination app with a broad workflow or query context.

## Scope

In scope:

- Extend cross-app prefill contracts with record focus metadata.
- Let Runtime Console pass `assetId`, `sourceKey`, and `workflowRunId` when opening successful asset landings.
- Make Deal Desk focus the written sales asset and its related deal when possible.
- Make Knowledge Vault focus the written knowledge asset when possible.
- Preserve fallback behavior for older receipts without structured metadata.

Out of scope:

- New route-level asset detail pages.
- New global URL scheme.
- Editing sales or knowledge assets from Runtime Console.
- Migrating historical receipts.
- Changing controlled writeback receipt persistence, which already stores structured asset metadata.
- Redesigning Deal Desk, Knowledge Vault, or Runtime Console.

## Current Behavior

Runtime Console already maps successful writeback receipts to target apps:

- `sales_asset` opens Deal Desk with workflow context.
- `knowledge_asset` opens Knowledge Vault with a search query based on `assetId`, `sourceKey`, or receipt detail.

This is useful but imprecise:

- Deal Desk may create a new lead from prefill instead of selecting the existing record that owns the written asset.
- Knowledge Vault receives a query string but does not explicitly select or highlight the exact knowledge asset.

## Design

### Cross-App Prefill Contracts

Extend `DealDeskPrefill` with optional focus fields:

```ts
type DealDeskPrefill = {
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
  // existing lead prefill fields remain unchanged
};
```

Extend `KnowledgeVaultPrefill` with optional focus fields:

```ts
type KnowledgeVaultPrefill = {
  query?: string;
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
};
```

These fields are optional so existing callers keep working.

### Runtime Console Open Action

When opening a successful `sales_asset` landing, Runtime Console should call:

```ts
requestOpenDealDesk({
  assetId: asset.assetId,
  sourceKey: asset.sourceKey,
  workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary.workflowRunId,
  workflowScenarioId: selectedControlledRunSummary.scenarioId,
  workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
  workflowNextStep: "Review the controlled run sales asset and continue the sales workflow.",
});
```

When opening a successful `knowledge_asset` landing, Runtime Console should call:

```ts
requestOpenKnowledgeVault({
  assetId: asset.assetId,
  sourceKey: asset.sourceKey,
  workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary.workflowRunId,
  query: asset.assetId ?? asset.sourceKey ?? asset.detail,
});
```

Skipped or failed receipts remain visible and do not receive an open action.

### Sales Asset Lookup

Add a client helper:

```ts
getSalesAssetById(assetId?: string | null): SalesAssetRecord | null
```

Deal Desk prefill handling should distinguish two modes:

1. Record focus mode:
   - If `assetId` is present and matches a sales asset, focus that asset.
   - If the asset has `dealId` and the deal exists, select that deal.
   - If `dealId` is missing or stale, fall back to an existing deal with the asset `workflowRunId`.
   - If no deal exists, do not create a synthetic deal just to satisfy the focus request; keep the existing selection and show a concise toast.

2. Lead prefill mode:
   - If no focus metadata is present, keep the current behavior of creating a new lead from prefill fields.

If `assetId` is missing but `workflowRunId` is present, Deal Desk can fall back to `getSalesAssetByWorkflowRunId`.

### Knowledge Asset Lookup

Add client helpers:

```ts
getKnowledgeAssetById(assetId?: string | null): KnowledgeAssetRecord | null
getKnowledgeAssetBySourceKey(sourceKey?: string | null): KnowledgeAssetRecord | null
```

Knowledge Vault should track a selected asset id:

```ts
const [focusedAssetId, setFocusedAssetId] = useState<string | null>(null);
```

When receiving a vault prefill:

- Prefer `assetId`.
- Then try `sourceKey`.
- Then fall back to `query`.

If a focused asset is found:

- set `focusedAssetId`,
- set `query` to a stable lookup value such as the asset title or source key so the item remains visible,
- clear the assistant answer,
- show a concise toast such as `已定位到知识资产`.

If no focused asset is found:

- keep current query prefill behavior,
- do not error.

In the asset list, the focused record should use the existing operational cockpit style:

- visible border emphasis,
- subtle blue or sky background,
- no layout change,
- no decorative animation.

### Fallback Rules

- Old receipts without `assetId` still open the relevant app with workflow/query context.
- If a record was deleted after the controlled run, the target app should open normally and display a toast or query fallback instead of throwing.
- Runtime Console remains read-only for the asset landing itself.

## Testing

Add focused tests for:

- `getSalesAssetById` returns the exact sales asset.
- `getKnowledgeAssetById` and `getKnowledgeAssetBySourceKey` return the exact knowledge asset.
- Runtime Console passes record focus metadata when opening sales and knowledge asset landings.
- Deal Desk focuses an existing deal from a sales asset prefill instead of creating a new lead.
- Knowledge Vault focuses and highlights the target knowledge asset from prefill metadata.

Keep existing regression gates:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

## Success Criteria

- A controlled run's sales asset landing opens Deal Desk focused on the written asset's related deal when the record still exists.
- A controlled run's knowledge asset landing opens Knowledge Vault focused on the exact written knowledge asset when the record still exists.
- Old receipts and missing records degrade to the existing workflow/query fallback.
- Runtime Console asset open actions remain read-only and auditable through the existing trace.
- Full verification passes with only the known existing lint/build warning.
