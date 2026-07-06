# Support Runtime Console Record Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make Runtime Console support asset landings open Support Copilot on the exact retained support asset / related ticket without creating duplicate support tickets.

**Architecture:** Treat Runtime Console support landings as record-focus prefills only when exact metadata (`assetId` or `sourceKey`) exists. Add focused support asset lookup helpers, pass receipt metadata through UI events, and make Support Copilot hold pending exact-focus requests until support assets / tickets are available. Broad support prefills keep the current ticket-creation path.

**Tech Stack:** Next.js / React, TypeScript, Vitest, React Testing Library, local server-backed list state helpers.

---

## File Structure

- `src/lib/support-assets.ts`: add optional `sourceKey` on support assets and lookup helpers for exact focus.
- `src/lib/ui-events.ts`: extend `SupportCopilotPrefill` with optional `assetId` and `sourceKey`.
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`: include support receipt metadata in Support Copilot open calls.
- `src/components/apps/SupportCopilotAppWindow.tsx`: split broad prefill from exact focus, resolve assets/tickets, retry hydration races, and show missing-record errors.
- `src/__tests__/lib/asset-record-focus.test.ts`: extend helper coverage for support assets.
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`: update support landing expectation.
- `src/__tests__/components/SupportCopilotAppWindow.test.tsx`: add component coverage for focus, fallback, hydration retry, and missing record behavior.
- `CHANGELOG.md`, `docs/NEXT_STEPS.md`, `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`, this plan, and `memory/2026-07-06.md`: final documentation and progress record.

---

### Task 1: Support Asset Focus Helpers

**Files:**
- Modify: `src/lib/support-assets.ts`
- Modify: `src/__tests__/lib/asset-record-focus.test.ts`

- [x] **Step 1: Write the failing helper tests**

Add this import block to `src/__tests__/lib/asset-record-focus.test.ts`:

```ts
import {
  getSupportAssetById,
  getSupportAssetBySourceKey,
  getSupportAssetForFocus,
  upsertSupportAsset,
} from "@/lib/support-assets";
```

Add this test inside `describe("record-level asset lookup helpers", () => { ... })`:

```ts
  it("finds a support asset by id, source key, and workflow fallback", () => {
    const asset = upsertSupportAsset("workflow-support-1", {
      sourceKey: "controlled-run:run-1:support_asset",
      scenarioId: "support-ops",
      ticketId: "ticket-1",
      customer: "Nora",
      channel: "email",
      issueSummary: "Warranty question",
    });

    expect(getSupportAssetById(asset.id)?.workflowRunId).toBe("workflow-support-1");
    expect(getSupportAssetBySourceKey("controlled-run:run-1:support_asset")?.id).toBe(
      asset.id,
    );
    expect(getSupportAssetForFocus({ assetId: asset.id })?.id).toBe(asset.id);
    expect(
      getSupportAssetForFocus({
        sourceKey: "controlled-run:run-1:support_asset",
        workflowRunId: "workflow-support-1",
      })?.id,
    ).toBe(asset.id);
    expect(getSupportAssetForFocus({ workflowRunId: "workflow-support-1" })?.id).toBe(
      asset.id,
    );
    expect(getSupportAssetById("missing")).toBeNull();
    expect(getSupportAssetBySourceKey("missing")).toBeNull();
    expect(getSupportAssetForFocus({ assetId: "missing" })).toBeNull();
  });
```

- [x] **Step 2: Run helper test to verify RED**

Run:

```bash
npm test -- src/__tests__/lib/asset-record-focus.test.ts
```

Expected: FAIL because `getSupportAssetById`, `getSupportAssetBySourceKey`, `getSupportAssetForFocus`, and `sourceKey` support do not exist yet.

- [x] **Step 3: Implement minimal helper support**

In `src/lib/support-assets.ts`, add `sourceKey?: string;` to `SupportAssetRecord` after `workflowRunId: string;`.

Add this exported type near the helper functions:

```ts
export type SupportAssetFocusInput = {
  assetId?: string | null;
  sourceKey?: string | null;
  workflowRunId?: string | null;
};
```

Add these functions after `getSupportAssetByWorkflowRunId`:

```ts
export function getSupportAssetById(assetId?: string | null) {
  if (!assetId) return null;
  return getSupportAssets().find((asset) => asset.id === assetId) ?? null;
}

export function getSupportAssetBySourceKey(sourceKey?: string | null) {
  if (!sourceKey) return null;
  return getSupportAssets().find((asset) => asset.sourceKey === sourceKey) ?? null;
}

export function getSupportAssetForFocus(input: SupportAssetFocusInput) {
  return (
    getSupportAssetById(input.assetId) ??
    getSupportAssetBySourceKey(input.sourceKey) ??
    getSupportAssetByWorkflowRunId(input.workflowRunId)
  );
}
```

Update `upsertSupportAsset` patch type to omit `sourceKey` as a core field:

```ts
patch: Partial<Omit<SupportAssetRecord, "id" | "workflowRunId" | "createdAt" | "updatedAt">>,
```

Keep the existing signature shape; `sourceKey` is allowed through the patch because it is not omitted.

In the new-record branch, set:

```ts
sourceKey: patch.sourceKey,
```

after `workflowRunId,`.

- [x] **Step 4: Run helper test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/lib/asset-record-focus.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/support-assets.ts src/__tests__/lib/asset-record-focus.test.ts
git commit -m "feat: add support asset focus helpers"
```

---

### Task 2: Runtime Console Passes Support Focus Metadata

**Files:**
- Modify: `src/lib/ui-events.ts`
- Modify: `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- Modify: `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`

- [x] **Step 1: Write the failing Runtime Console expectation**

In the support landing test in `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`, change the expectation to:

```ts
    expect(requestOpenSupportCopilot).toHaveBeenCalledWith({
      assetId: "controlled-support-asset:workflow-assets-1",
      sourceKey: "controlled-run:run-assets-1:support_asset",
      workflowRunId: "workflow-assets-1",
      workflowScenarioId: "sales-pipeline",
      workflowSource: "Runtime Console asset controlled-support-asset:workflow-assets-1",
      workflowNextStep:
        "Review the controlled run support asset and continue support resolution.",
    });
```

- [x] **Step 2: Run component test to verify RED**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: FAIL because `assetId` and `sourceKey` are not passed.

- [x] **Step 3: Extend the prefill type and pass metadata**

In `src/lib/ui-events.ts`, change `SupportCopilotPrefill` to:

```ts
export type SupportCopilotPrefill = {
  assetId?: string;
  sourceKey?: string;
  customer?: string;
  channel?: SupportChannel;
  subject?: string;
  message?: string;
  status?: SupportStatus;
  replyDraft?: string;
} & WorkflowContextMeta;
```

In `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`, update the `support_copilot` branch:

```ts
    if (asset.appId === "support_copilot") {
      requestOpenSupportCopilot({
        assetId: asset.assetId,
        sourceKey: asset.sourceKey,
        workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary?.workflowRunId,
        workflowScenarioId: selectedControlledRunSummary?.scenarioId,
        workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
        workflowNextStep:
          "Review the controlled run support asset and continue support resolution.",
      });
      showToast("已打开 Support Copilot", "ok");
    }
```

- [x] **Step 4: Run component test to verify GREEN**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/ui-events.ts src/components/apps/ClawRuntimeConsoleAppWindow.tsx src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
git commit -m "feat: pass support asset focus metadata"
```

---

### Task 3: Support Copilot Exact Focus

**Files:**
- Create: `src/__tests__/components/SupportCopilotAppWindow.test.tsx`
- Modify: `src/components/apps/SupportCopilotAppWindow.tsx`

- [x] **Step 1: Write failing tests for exact focus and broad fallback**

Create `src/__tests__/components/SupportCopilotAppWindow.test.tsx` with:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportCopilotAppWindow } from "@/components/apps/SupportCopilotAppWindow";
import { createSupportTicket, getSupportTickets } from "@/lib/support";
import { upsertSupportAsset } from "@/lib/support-assets";

vi.mock("@/lib/openclaw-agent-client", () => ({
  requestOpenClawAgent: vi.fn(),
  requestRealityCheck: vi.fn(),
}));

function renderSupportCopilot() {
  return render(
    <SupportCopilotAppWindow
      state="open"
      zIndex={1}
      active
      onFocus={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: {} })),
  );
});

describe("SupportCopilotAppWindow record focus", () => {
  it("focuses an existing ticket from support asset metadata without creating a duplicate", async () => {
    const firstTicketId = createSupportTicket({
      customer: "First Customer",
      subject: "First ticket",
      workflowRunId: "workflow-first",
    });
    const targetTicketId = createSupportTicket({
      customer: "Target Customer",
      subject: "Target warranty issue",
      workflowRunId: "workflow-support-1",
    });
    const asset = upsertSupportAsset("workflow-support-1", {
      sourceKey: "controlled-run:run-1:support_asset",
      scenarioId: "support-ops",
      ticketId: targetTicketId,
      customer: "Target Customer",
      channel: "email",
      issueSummary: "Target issue",
    });

    renderSupportCopilot();

    await screen.findByDisplayValue("First Customer");

    window.dispatchEvent(
      new CustomEvent("openclaw:support-copilot-prefill", {
        detail: {
          assetId: asset.id,
          sourceKey: "controlled-run:run-1:support_asset",
          workflowRunId: "workflow-support-1",
        },
      }),
    );

    await screen.findByDisplayValue("Target Customer");
    expect(screen.queryByDisplayValue("First Customer")).not.toBeInTheDocument();
    expect(getSupportTickets()).toHaveLength(2);
    expect(getSupportTickets().map((ticket) => ticket.id)).toEqual(
      expect.arrayContaining([firstTicketId, targetTicketId]),
    );
  });

  it("keeps broad support prefill creating a new ticket", async () => {
    renderSupportCopilot();

    window.dispatchEvent(
      new CustomEvent("openclaw:support-copilot-prefill", {
        detail: {
          customer: "Broad Customer",
          channel: "email",
          subject: "Broad handoff",
          message: "Please help with this issue.",
          status: "new",
        },
      }),
    );

    await screen.findByDisplayValue("Broad Customer");
    expect(screen.getByDisplayValue("Broad handoff")).toBeInTheDocument();
    expect(getSupportTickets()).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/__tests__/components/SupportCopilotAppWindow.test.tsx
```

Expected: FAIL because record-focus prefill still creates a new support ticket instead of selecting the existing one.

- [x] **Step 3: Implement exact focus selection**

In `src/components/apps/SupportCopilotAppWindow.tsx`, update the support asset imports:

```ts
import {
  getSupportAssetByWorkflowRunId,
  getSupportAssetForFocus,
  subscribeSupportAssets,
  upsertSupportAsset,
  type SupportAssetRecord,
} from "@/lib/support-assets";
```

Add these helpers before the component:

```ts
function hasSupportRecordFocus(detail?: SupportCopilotPrefill | null) {
  return Boolean(detail?.assetId || detail?.sourceKey);
}

function findTicketForSupportAsset(asset: SupportAssetRecord) {
  const tickets = getSupportTickets();
  return (
    tickets.find((ticket) => asset.ticketId && ticket.id === asset.ticketId) ??
    tickets.find((ticket) => ticket.workflowRunId === asset.workflowRunId) ??
    null
  );
}
```

Replace the current `onPrefill` effect body with this split behavior:

```ts
  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<SupportCopilotPrefill>).detail;
      if (hasSupportRecordFocus(detail)) {
        const asset = getSupportAssetForFocus(detail);
        const targetTicket = asset ? findTicketForSupportAsset(asset) : null;
        if (targetTicket) {
          setSelectedId(targetTicket.id);
          showToast("已定位到客服工单", "ok");
          return;
        }
        showToast("未找到对应客服工单", "error");
        return;
      }

      const id = createSupportTicket({
        customer: detail?.customer ?? "",
        channel: detail?.channel ?? "email",
        subject: detail?.subject ?? "",
        message: detail?.message ?? "",
        status: detail?.status ?? "new",
        replyDraft: detail?.replyDraft ?? "",
        ...buildSupportWorkflowMeta(detail),
      });
      setSelectedId(id);
      showToast("已带入客服场景上下文", "ok");
    };
    window.addEventListener("openclaw:support-copilot-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:support-copilot-prefill", onPrefill);
  }, [showToast]);
```

- [x] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/__tests__/components/SupportCopilotAppWindow.test.tsx
```

Expected: PASS for exact focus and broad fallback.

- [x] **Step 5: Commit**

```bash
git add src/components/apps/SupportCopilotAppWindow.tsx src/__tests__/components/SupportCopilotAppWindow.test.tsx
git commit -m "feat: focus support copilot records"
```

---

### Task 4: Pending Hydration Retry And Missing Record Guard

**Files:**
- Modify: `src/__tests__/components/SupportCopilotAppWindow.test.tsx`
- Modify: `src/components/apps/SupportCopilotAppWindow.tsx`

- [x] **Step 1: Add failing hydration and missing-record tests**

Add these tests inside `describe("SupportCopilotAppWindow record focus", () => { ... })`:

```tsx
  it("keeps support record focus pending until asset and ticket stores update", async () => {
    renderSupportCopilot();

    window.dispatchEvent(
      new CustomEvent("openclaw:support-copilot-prefill", {
        detail: {
          assetId: "support-asset-pending",
          sourceKey: "controlled-run:run-pending:support_asset",
          workflowRunId: "workflow-pending",
        },
      }),
    );

    expect(getSupportTickets()).toHaveLength(0);

    const ticketId = createSupportTicket({
      customer: "Hydrated Customer",
      subject: "Hydrated issue",
      workflowRunId: "workflow-pending",
    });
    upsertSupportAsset("workflow-pending", {
      sourceKey: "controlled-run:run-pending:support_asset",
      scenarioId: "support-ops",
      ticketId,
      customer: "Hydrated Customer",
      channel: "email",
      issueSummary: "Hydrated issue",
    });

    await screen.findByDisplayValue("Hydrated Customer");
    expect(getSupportTickets()).toHaveLength(1);
  });

  it("does not create a synthetic ticket when an exact support record stays missing", async () => {
    renderSupportCopilot();

    window.dispatchEvent(
      new CustomEvent("openclaw:support-copilot-prefill", {
        detail: {
          assetId: "missing-support-asset",
          sourceKey: "controlled-run:run-missing:support_asset",
          workflowRunId: "workflow-missing",
        },
      }),
    );

    window.dispatchEvent(new Event("openclaw:support-assets"));
    window.dispatchEvent(new Event("openclaw:support-tickets"));

    await screen.findByText("未找到对应客服工单");
    expect(getSupportTickets()).toHaveLength(0);
  });
```

- [x] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/__tests__/components/SupportCopilotAppWindow.test.tsx
```

Expected: FAIL because missing focus errors immediately and does not retry pending focus.

- [x] **Step 3: Implement pending focus retry**

In `src/components/apps/SupportCopilotAppWindow.tsx`, add state inside the component:

```ts
  const [pendingFocus, setPendingFocus] = useState<{
    detail: SupportCopilotPrefill;
    attempts: number;
  } | null>(null);
```

Add this resolver inside the component before the prefill effect:

```ts
  const resolveSupportRecordFocus = useCallback(
    (detail: SupportCopilotPrefill, attempts: number) => {
      const asset = getSupportAssetForFocus(detail);
      const targetTicket = asset ? findTicketForSupportAsset(asset) : null;
      if (targetTicket) {
        setSelectedId(targetTicket.id);
        setPendingFocus(null);
        showToast("已定位到客服工单", "ok");
        return true;
      }
      if (attempts > 0) {
        setPendingFocus(null);
        showToast("未找到对应客服工单", "error");
      } else {
        setPendingFocus({ detail, attempts: attempts + 1 });
      }
      return false;
    },
    [showToast],
  );
```

Update the React import:

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
```

In the prefill effect, replace the record-focus branch with:

```ts
      if (hasSupportRecordFocus(detail)) {
        resolveSupportRecordFocus(detail, 0);
        return;
      }
```

and add `resolveSupportRecordFocus` to the effect dependencies.

Add a retry effect after the support asset subscription effect:

```ts
  useEffect(() => {
    if (!pendingFocus) return;
    resolveSupportRecordFocus(pendingFocus.detail, pendingFocus.attempts);
  }, [assetRevision, pendingFocus, resolveSupportRecordFocus, tickets]);
```

- [x] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/__tests__/components/SupportCopilotAppWindow.test.tsx
```

Expected: PASS.

- [x] **Step 5: Run focused controlled-runtime tests**

Run:

```bash
npm test -- src/__tests__/lib/asset-record-focus.test.ts src/__tests__/components/SupportCopilotAppWindow.test.tsx src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/apps/SupportCopilotAppWindow.tsx src/__tests__/components/SupportCopilotAppWindow.test.tsx
git commit -m "fix: retry support record focus hydration"
```

---

### Task 5: Controlled Runtime Verification And Docs

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-support-runtime-console-record-focus.md`
- Modify: `memory/2026-07-06.md`

- [x] **Step 1: Run required verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `npm run lint` and `npm run build` may still show the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.

- [x] **Step 2: Update docs**

Update:

- `CHANGELOG.md`: add a dated entry describing support record focus.
- `docs/NEXT_STEPS.md`: move P0 to Trace Governance or the next recommended backlog item.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: mark Phase 9 complete and make Trace Governance the next default phase.
- This plan: check off completed tasks and record verification results.
- `memory/2026-07-06.md`: append commits, behavior, verification, and next phase.

- [x] **Step 3: Re-run final verification after docs**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0 with only the known existing `<img>` warning if present.

- [x] **Step 4: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-support-runtime-console-record-focus.md memory/2026-07-06.md
git commit -m "docs: complete support record focus"
```

---

## Plan Self-Review

- Spec coverage: Runtime Console metadata, Support Copilot exact focus, broad fallback, hydration retry, missing-record guard, helper tests, docs, and verification all have tasks.
- Placeholder scan: the plan contains no unresolved markers or vague implementation placeholders.
- Type consistency: `assetId`, `sourceKey`, `workflowRunId`, `SupportCopilotPrefill`, and `SupportAssetRecord.sourceKey` names are consistent across tasks.

## Completion Record

Commits:

- `459a05c` — `docs: spec support record focus`
- `cc055f5` — `docs: plan support record focus`
- `b864770` — `feat: add support asset focus helpers`
- `981db95` — `feat: pass support asset focus metadata`
- `55e56a0` — `feat: focus support copilot records`
- `fda34fb` — `fix: retry support record focus hydration`

Verification before documentation:

- `npm test -- src/__tests__/lib/asset-record-focus.test.ts src/__tests__/components/SupportCopilotAppWindow.test.tsx src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx` — 3 files / 12 tests passed.
- `npm run test:controlled-runtime` — 21 files / 128 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.

Final verification after documentation:

- `npm run test:controlled-runtime` — 21 files / 128 tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `npm run build` — exit 0 with the same existing warning.
- `git diff --check` — exit 0.
