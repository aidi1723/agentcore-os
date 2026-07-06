# Support Runtime Console Record Focus Design

## Context

Support Playbook Migration made `support-resolution-v1` a controlled playbook and added server-backed `support_asset` writeback. Runtime Console can now list those receipts and open Support Copilot, but the open action only passes broad workflow context. Support Copilot currently treats every prefill as a new-ticket request, so opening a controlled support asset can create a duplicate local support ticket instead of focusing the retained support asset / ticket.

This phase completes the support equivalent of the existing Deal Desk and Knowledge Vault record-focus behavior.

## Goals

- Runtime Console `support_asset` landings pass exact record metadata: `assetId`, `sourceKey`, and `workflowRunId`.
- Support Copilot recognizes record-focus prefill metadata and focuses the retained support asset / related ticket instead of creating a synthetic ticket.
- If the open event arrives before support assets or tickets hydrate, Support Copilot keeps the focus request pending and retries on store updates.
- Missing exact records fail visibly with a toast and do not create duplicate support tickets.
- Legacy support prefills without structured asset metadata keep the existing broad behavior: create a new ticket from customer / subject / message context.

## Non-Goals

- No visual redesign of Support Copilot or Runtime Console.
- No new support playbook stages.
- No asset-only detail panel in Support Copilot during this slice. The first implementation selects the related ticket when available and reports a missing ticket when the exact support asset exists but the related ticket cannot be resolved.
- No broad refactor of support ticket storage.

## Current Gap

`ClawRuntimeConsoleAppWindow` already receives `ControlledRunAssetLandingSummary` records with `assetId`, `sourceKey`, and `workflowRunId`, but the `support_copilot` branch drops `assetId` and `sourceKey`.

`SupportCopilotAppWindow` listens for `openclaw:support-copilot-prefill` and immediately calls `createSupportTicket(...)`. That is correct for manual handoffs from Knowledge Vault or Inbox Declutter, but it is wrong for record-focus landings from Runtime Console.

`src/lib/support-assets.ts` can find support assets by `workflowRunId`; it lacks exact lookup helpers by `id` / `sourceKey` and a single focus resolver.

## Proposed Behavior

### Runtime Console

When a successful `support_asset` receipt is opened, Runtime Console calls `requestOpenSupportCopilot` with:

- `assetId`: receipt asset id, when present.
- `sourceKey`: receipt source key, when present.
- `workflowRunId`: receipt workflow run id, falling back to the selected controlled run summary workflow id.
- Existing workflow scenario/source/next-step context.

Legacy receipts without `assetId` and `sourceKey` remain broad handoffs. They may include workflow context, but they must not force exact-record mode unless at least one exact support focus field is present.

### Support Asset Lookup

Add focused helpers in `src/lib/support-assets.ts`:

- `getSupportAssetById(assetId?: string | null)`
- `getSupportAssetBySourceKey(sourceKey?: string | null)`
- `getSupportAssetForFocus({ assetId, sourceKey, workflowRunId })`

`sourceKey` is optional on `SupportAssetRecord`. It should be stored when support asset writeback has that durable receipt key, while existing local assets without a source key continue to work by id / workflow id.

Lookup priority:

1. `assetId`
2. `sourceKey`
3. `workflowRunId`

This mirrors the precision of the receipt: exact id first, stable source key second, run-level fallback last.

### Support Copilot Focus

Support Copilot distinguishes two prefill modes:

- **Record focus prefill:** has `assetId` or `sourceKey`. It never creates a ticket.
- **Broad prefill:** lacks `assetId` and `sourceKey`. It keeps the current new-ticket behavior.

For record focus:

1. Resolve the support asset through `getSupportAssetForFocus`.
2. Resolve a related ticket by `asset.ticketId`, or by matching `ticket.workflowRunId === asset.workflowRunId`.
3. If found, select that ticket and show a success toast.
4. If the asset or ticket is not currently available, keep the focus request pending.
5. Retry pending focus after support asset or support ticket subscriptions fire.
6. After at least one retry opportunity, show an error toast and clear the pending request if the exact record still cannot be resolved.

The missing-record path must not call `createSupportTicket`. This prevents Runtime Console from manufacturing support tickets that do not correspond to the controlled writeback record.

### Tests

Add coverage for:

- Support asset lookup helpers by id, source key, and fallback workflow run id.
- Runtime Console support landing passes `assetId` and `sourceKey`.
- Support Copilot record-focus prefill selects an existing related ticket and does not create a duplicate.
- Support Copilot broad prefill still creates a new ticket.
- Support Copilot record-focus prefill before hydration retries after assets / tickets appear.
- Missing exact record produces a visible error and no synthetic ticket.

## Acceptance Criteria

- A controlled support run's `support_asset` landing opens Support Copilot and selects the related existing support ticket.
- The selected ticket's current support asset remains available to existing recommendation / FAQ flows.
- Exact support focus missing paths are visible and non-destructive.
- Legacy broad support handoffs keep working.
- `npm run test:controlled-runtime`, `npm run test:core-workflows`, `npm run lint`, `npm run build`, and `git diff --check` pass with only the known existing `<img>` warning if it remains.
