# Runtime Console Asset Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured asset landing metadata and click-through actions from Runtime Console to Deal Desk and Knowledge Vault.

**Architecture:** Extend controlled writeback receipts with optional structured metadata, derive pure console summary link fields, then wire Runtime Console buttons to the existing `requestOpenDealDesk` and `requestOpenKnowledgeVault` event helpers. Keep backward compatibility for historical receipts that only have summaries.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest, existing controlled runtime stores and UI event helpers.

---

## Scope

Spec: [Runtime Console Asset Deep Links Design](../specs/2026-07-05-runtime-console-asset-deep-links-design.md)

In scope:

- Structured receipt metadata for sales and knowledge writeback.
- Asset landing summary metadata and app id mapping.
- Asset id/source key/receipt summary search.
- Runtime Console open actions for successful sales and knowledge landings.
- Documentation and verification update.

Out of scope:

- Failed step retry controls.
- New asset detail APIs.
- Historical receipt migration.
- CRM or Knowledge Vault record editing.

## File Structure

Modify:

- `src/lib/executor/runtime/types.ts`
- `src/lib/executor/runtime/writeback.ts`
- `src/__tests__/lib/executor/runtime/writeback.test.ts`
- `src/lib/executor/runtime/console-summary.ts`
- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `CHANGELOG.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-05.md`

---

### Task 1: Add Structured Writeback Receipt Metadata

- [x] **Step 1: Write failing writeback metadata tests**

Extend `src/__tests__/lib/executor/runtime/writeback.test.ts` with assertions on successful receipts:

```ts
expect(receipts).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      target: "sales_asset",
      ok: true,
      assetId: "controlled-sales-asset:workflow-asset-1",
      workflowRunId: "workflow-asset-1",
    }),
    expect.objectContaining({
      target: "knowledge_asset",
      ok: true,
      assetId: "controlled-knowledge-asset:run-asset-1",
      sourceKey: "controlled-run:run-asset-1:knowledge_asset",
      workflowRunId: "workflow-asset-1",
    }),
  ]),
);
```

- [x] **Step 2: Verify writeback tests fail**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: FAIL because receipts do not expose `assetId`, `sourceKey`, or `workflowRunId`.

- [x] **Step 3: Extend receipt type and writeback metadata**

Modify `src/lib/executor/runtime/types.ts`:

```ts
export type ControlledWritebackReceipt = {
  target: string;
  ok: boolean;
  summary: string;
  writtenAt: number;
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
};
```

Modify `src/lib/executor/runtime/writeback.ts` success receipts:

```ts
return {
  target: "sales_asset",
  ok: true,
  summary: `Wrote sales asset ${stored.id} for workflow ${stored.workflowRunId}`,
  writtenAt,
  assetId: stored.id,
  workflowRunId: stored.workflowRunId,
} satisfies ControlledWritebackReceipt;
```

```ts
return {
  target: "knowledge_asset",
  ok: true,
  summary: `Wrote knowledge asset ${stored.id} from ${stored.sourceKey}`,
  writtenAt,
  assetId: stored.id,
  sourceKey: stored.sourceKey,
  workflowRunId: stored.workflowRunId,
} satisfies ControlledWritebackReceipt;
```

- [x] **Step 4: Verify writeback tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/types.ts src/lib/executor/runtime/writeback.ts src/__tests__/lib/executor/runtime/writeback.test.ts
git commit -m "feat: add controlled writeback asset metadata"
```

### Task 2: Surface Asset Link Metadata In Console Summary

- [x] **Step 1: Write failing summary tests**

Extend `src/__tests__/lib/executor/runtime/console-summary.test.ts` so the sample receipts include metadata and the expected `assetLandings` include:

```ts
{
  target: "sales_asset",
  label: "Sales asset",
  detail: "Wrote sales asset controlled-sales-asset:workflow-1 for workflow workflow-1",
  ok: true,
  assetId: "controlled-sales-asset:workflow-1",
  workflowRunId: "workflow-1",
  appId: "deal_desk",
}
```

```ts
{
  target: "knowledge_asset",
  label: "Knowledge asset",
  detail:
    "Wrote knowledge asset controlled-knowledge-asset:run-console-1 from controlled-run:run-console-1:knowledge_asset",
  ok: true,
  assetId: "controlled-knowledge-asset:run-console-1",
  sourceKey: "controlled-run:run-console-1:knowledge_asset",
  workflowRunId: "workflow-1",
  appId: "knowledge_vault",
}
```

Add a filter assertion:

```ts
expect(
  filterControlledRunConsoleSummaries([completed, awaiting], {
    state: "all",
    query: "controlled-knowledge-asset:run-console-1",
  }).map((summary) => summary.id),
).toEqual(["run-console-1"]);
```

- [x] **Step 2: Verify summary tests fail**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: FAIL because asset landing metadata and asset query fields are not derived.

- [x] **Step 3: Implement summary metadata and filter fields**

Modify `src/lib/executor/runtime/console-summary.ts`:

```ts
export type ControlledRunAssetLandingSummary = {
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

Add:

```ts
const ASSET_APP_IDS: Record<string, ControlledRunAssetLandingSummary["appId"]> = {
  sales_asset: "deal_desk",
  knowledge_asset: "knowledge_vault",
};
```

Return the receipt metadata from `buildAssetLandings`, and extend filtering with `summary.error`, landing fields, and receipt summaries.

- [x] **Step 4: Verify summary tests pass**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/executor/runtime/console-summary.ts src/__tests__/lib/executor/runtime/console-summary.test.ts
git commit -m "feat: derive controlled run asset links"
```

### Task 3: Wire Runtime Console Asset Open Actions

- [x] **Step 1: Import app open helpers**

Modify `src/components/apps/ClawRuntimeConsoleAppWindow.tsx` imports:

```ts
import {
  requestOpenDealDesk,
  requestOpenKnowledgeVault,
} from "@/lib/ui-events";
```

- [x] **Step 2: Add asset open handler**

Add a local handler near the other controlled run handlers:

```ts
function handleOpenControlledRunAsset(asset: ControlledRunAssetLandingSummary) {
  if (asset.appId === "deal_desk") {
    requestOpenDealDesk({
      workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary?.workflowRunId,
      workflowScenarioId: selectedControlledRunSummary?.scenarioId,
      workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
      workflowNextStep: "Review the controlled run sales asset and continue the sales workflow.",
    });
    showToast("已打开 Deal Desk", "ok");
    return;
  }

  if (asset.appId === "knowledge_vault") {
    requestOpenKnowledgeVault({
      query: asset.assetId ?? asset.sourceKey ?? asset.detail,
    });
    showToast("已打开 Knowledge Vault", "ok");
  }
}
```

- [x] **Step 3: Render metadata and open buttons**

In the `Asset landings` block:

- show `asset.assetId`, `asset.sourceKey`, and `asset.workflowRunId` when present,
- render an `打开` button only when `asset.ok && asset.appId`,
- call `handleOpenControlledRunAsset(asset)`.

- [x] **Step 4: Verify controlled runtime, lint, and build**

Run:

```bash
npm run test:controlled-runtime
npm run lint
npm run build
```

Expected: PASS, with only the existing `<img>` warning for lint/build.

- [x] **Step 5: Commit**

```bash
git add src/components/apps/ClawRuntimeConsoleAppWindow.tsx
git commit -m "feat: open controlled run asset landings"
```

### Task 4: Final Verification And Docs

- [x] **Step 1: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

- [x] **Step 2: Update docs and memory**

Update changelog, development manual, this plan checklist, and daily memory with Phase 7 asset deep-link progress.

- [x] **Step 3: Commit docs**

```bash
git add CHANGELOG.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-05-runtime-console-asset-deep-links.md
git commit -m "docs: track runtime console asset deep links"
```

## Self-Review

- Spec coverage: receipt metadata, summary metadata, query filtering, UI open actions, docs, and verification are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: `assetId`, `sourceKey`, `workflowRunId`, and `appId` use the same names across receipt, summary, tests, and UI.

## Completion Notes

- `ControlledWritebackReceipt` now supports `assetId`, `sourceKey`, and `workflowRunId`.
- `writeControlledStepAssets` records structured metadata for successful sales and knowledge asset writes.
- `ControlledRunAssetLandingSummary` now exposes asset metadata and target app ids for `deal_desk` / `knowledge_vault`.
- Runtime Console asset search now includes asset ids, source keys, workflow ids, receipt summaries, and run errors.
- Runtime Console asset landings now show structured metadata and provide `打开` actions for successful sales / knowledge landings.
- Verification completed:
  - `npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts` — 4 tests passed.
  - `npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts` — 4 tests passed.
  - `npm run test:controlled-runtime` — 14 files, 97 tests passed.
  - `npm run test:core-workflows` — all regressions passed.
  - `npm run lint` — exit 0, existing `<img>` warning only.
  - `npm run build` — exit 0, same existing warning.
