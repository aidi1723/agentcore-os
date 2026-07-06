# Runtime Console Record-Level Asset Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Runtime Console asset landings open Deal Desk / Knowledge Vault focused on the exact retained record written by the controlled run.

**Architecture:** Extend existing optional prefill contracts, add narrow asset lookup helpers, and keep focus behavior inside the destination apps. Runtime Console stays read-only and only forwards receipt metadata that already exists in controlled writeback receipts.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest, Testing Library, existing local/server-backed asset stores.

---

## Scope

Spec: [Runtime Console Record-Level Asset Focus Design](../specs/2026-07-06-runtime-console-record-level-asset-focus-design.md)

In scope:

- `DealDeskPrefill.assetId/sourceKey` and `KnowledgeVaultPrefill.assetId/sourceKey/workflowRunId`.
- `getSalesAssetById`.
- `getKnowledgeAssetById` and `getKnowledgeAssetBySourceKey`.
- Runtime Console passes record focus metadata in open actions.
- Deal Desk focuses an existing deal/sales asset from record metadata instead of creating a new lead.
- Knowledge Vault focuses and visually highlights the exact knowledge asset.
- Regression script includes the new focus coverage.

Out of scope:

- New asset detail pages.
- URL routing.
- Historical receipt migration.
- Asset editing from Runtime Console.
- Broad UI redesign.

## File Structure

Modify:

- `src/lib/ui-events.ts`
- `src/lib/sales-assets.ts`
- `src/lib/knowledge-assets.ts`
- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- `src/components/apps/DealDeskAppWindow.tsx`
- `src/components/apps/KnowledgeVaultAppWindow.tsx`
- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- `package.json`
- `CHANGELOG.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `docs/NEXT_STEPS.md`
- `memory/2026-07-06.md` if local memory is being maintained

Create:

- `src/__tests__/lib/asset-record-focus.test.ts`
- `src/__tests__/components/DealDeskAppWindow.test.tsx`
- `src/__tests__/components/KnowledgeVaultAppWindow.test.tsx`

---

### Task 1: Add Asset Lookup Helpers

**Files:**

- Modify: `src/lib/sales-assets.ts`
- Modify: `src/lib/knowledge-assets.ts`
- Create: `src/__tests__/lib/asset-record-focus.test.ts`

- [ ] **Step 1: Write failing lookup tests**

Create `src/__tests__/lib/asset-record-focus.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSalesAssetById,
  getSalesAssetByWorkflowRunId,
  upsertSalesAsset,
} from "@/lib/sales-assets";
import {
  getKnowledgeAssetById,
  getKnowledgeAssetBySourceKey,
  upsertKnowledgeAsset,
} from "@/lib/knowledge-assets";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: {} })),
  );
});

describe("record-level asset lookup helpers", () => {
  it("finds a sales asset by id", () => {
    const asset = upsertSalesAsset("workflow-sales-1", {
      scenarioId: "sales-pipeline",
      dealId: "deal-1",
      company: "Aperture Facades",
      contactName: "Nora",
      requirementSummary: "Curtain wall quote",
    });

    expect(getSalesAssetById(asset.id)?.workflowRunId).toBe("workflow-sales-1");
    expect(getSalesAssetByWorkflowRunId("workflow-sales-1")?.id).toBe(asset.id);
    expect(getSalesAssetById("missing")).toBeNull();
  });

  it("finds a knowledge asset by id and source key", () => {
    const asset = upsertKnowledgeAsset("controlled-run:run-1:knowledge_asset", {
      title: "Sales follow-up pattern",
      body: "Use approved lead context before drafting.",
      sourceApp: "personal_crm",
      scenarioId: "sales-pipeline",
      workflowRunId: "workflow-sales-1",
      assetType: "sales_playbook",
      status: "active",
      tags: ["sales"],
      applicableScene: "Door and window inquiry",
    });

    expect(getKnowledgeAssetById(asset.id)?.sourceKey).toBe(
      "controlled-run:run-1:knowledge_asset",
    );
    expect(getKnowledgeAssetBySourceKey("controlled-run:run-1:knowledge_asset")?.id).toBe(
      asset.id,
    );
    expect(getKnowledgeAssetById("missing")).toBeNull();
    expect(getKnowledgeAssetBySourceKey("missing")).toBeNull();
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm test -- src/__tests__/lib/asset-record-focus.test.ts
```

Expected: FAIL because `getSalesAssetById`, `getKnowledgeAssetById`, and `getKnowledgeAssetBySourceKey` are not exported.

- [ ] **Step 3: Implement minimal lookup helpers**

In `src/lib/sales-assets.ts`, add after `getSalesAssets()`:

```ts
export function getSalesAssetById(assetId?: string | null) {
  if (!assetId) return null;
  return getSalesAssets().find((asset) => asset.id === assetId) ?? null;
}
```

In `src/lib/knowledge-assets.ts`, add after `getKnowledgeAssets()`:

```ts
export function getKnowledgeAssetById(assetId?: string | null) {
  if (!assetId) return null;
  return getKnowledgeAssets().find((asset) => asset.id === assetId) ?? null;
}

export function getKnowledgeAssetBySourceKey(sourceKey?: string | null) {
  if (!sourceKey) return null;
  return getKnowledgeAssets().find((asset) => asset.sourceKey === sourceKey) ?? null;
}
```

- [ ] **Step 4: Verify lookup tests pass**

Run:

```bash
npm test -- src/__tests__/lib/asset-record-focus.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales-assets.ts src/lib/knowledge-assets.ts src/__tests__/lib/asset-record-focus.test.ts
git commit -m "feat: add record-level asset lookup helpers"
```

### Task 2: Extend Prefill Contracts And Runtime Console Metadata

**Files:**

- Modify: `src/lib/ui-events.ts`
- Modify: `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
- Modify: `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`

- [ ] **Step 1: Write failing Runtime Console open-action test**

Extend `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx` imports:

```ts
import {
  requestOpenDealDesk,
  requestOpenKnowledgeVault,
} from "@/lib/ui-events";
```

Use the existing `vi.mock("@/lib/ui-events", ...)` mock and add this test:

```ts
function buildCompletedRunWithAssetLandings(): ControlledExecutionRunRecord {
  return {
    id: "run-assets-1",
    requestId: "request-assets-1",
    sessionId: "session-1",
    workflowRunId: "workflow-assets-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-assets-1",
    state: "completed",
    createdAt: 1,
    updatedAt: 2,
    auditEvents: [],
    plan: {
      id: "plan-assets-1",
      goal: "Asset writeback",
      requiresApproval: false,
      totalSteps: 1,
      steps: [
        {
          id: "writeback",
          title: "Write assets",
          description: "Write assets",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
        },
      ],
    },
    steps: [
      {
        stepId: "writeback",
        state: "completed",
        input: {},
        output: {},
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [
          {
            target: "sales_asset",
            ok: true,
            summary: "Sales asset written",
            writtenAt: 2,
            assetId: "sales-asset-1",
            workflowRunId: "workflow-assets-1",
          },
          {
            target: "knowledge_asset",
            ok: true,
            summary: "Knowledge asset written",
            writtenAt: 2,
            assetId: "knowledge-asset-1",
            sourceKey: "controlled-run:run-assets-1:knowledge_asset",
            workflowRunId: "workflow-assets-1",
          },
        ],
      },
    ],
  };
}

it("passes record focus metadata when opening controlled run asset landings", async () => {
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const href = String(url);
    if (href.endsWith("/api/runtime/executor/controlled-runs")) {
      return Response.json({
        ok: true,
        data: { runs: [buildCompletedRunWithAssetLandings()] },
      });
    }
    if (href.endsWith("/api/runtime/executor/sessions")) {
      return Response.json({ ok: true, data: { sessions: [] } });
    }
    return Response.json({ ok: true, data: {} });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(
    <ClawRuntimeConsoleAppWindow
      state="open"
      zIndex={1}
      active
      onFocus={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );

  const openButtons = await screen.findAllByRole("button", { name: "打开" });
  fireEvent.click(openButtons[0]);
  expect(requestOpenDealDesk).toHaveBeenCalledWith(
    expect.objectContaining({
      assetId: "sales-asset-1",
      workflowRunId: "workflow-assets-1",
      workflowScenarioId: "sales-pipeline",
    }),
  );

  fireEvent.click(openButtons[1]);
  expect(requestOpenKnowledgeVault).toHaveBeenCalledWith(
    expect.objectContaining({
      assetId: "knowledge-asset-1",
      sourceKey: "controlled-run:run-assets-1:knowledge_asset",
      workflowRunId: "workflow-assets-1",
      query: "knowledge-asset-1",
    }),
  );
});
```

- [ ] **Step 2: Verify Runtime Console test fails**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: FAIL because `assetId` / `sourceKey` are not forwarded in open prefill payloads.

- [ ] **Step 3: Extend prefill types**

In `src/lib/ui-events.ts`, extend `DealDeskPrefill`:

```ts
export type DealDeskPrefill = {
  assetId?: string;
  sourceKey?: string;
  company?: string;
  contact?: string;
  inquiryChannel?: string;
  preferredLanguage?: string;
  productLine?: string;
  need?: string;
  budget?: string;
  timing?: string;
  notes?: string;
  stage?: DealStage;
} & SalesWorkflowMeta;
```

Extend `KnowledgeVaultPrefill`:

```ts
export type KnowledgeVaultPrefill = {
  query?: string;
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
};
```

- [ ] **Step 4: Forward metadata from Runtime Console**

In `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`, update `handleOpenControlledRunAsset`:

```ts
if (asset.appId === "deal_desk") {
  requestOpenDealDesk({
    assetId: asset.assetId,
    sourceKey: asset.sourceKey,
    workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary?.workflowRunId,
    workflowScenarioId: selectedControlledRunSummary?.scenarioId,
    workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
    workflowNextStep:
      "Review the controlled run sales asset and continue the sales workflow.",
  });
  showToast("已打开 Deal Desk", "ok");
  return;
}

if (asset.appId === "knowledge_vault") {
  requestOpenKnowledgeVault({
    assetId: asset.assetId,
    sourceKey: asset.sourceKey,
    workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary?.workflowRunId,
    query: asset.assetId ?? asset.sourceKey ?? asset.detail,
  });
  showToast("已打开 Knowledge Vault", "ok");
}
```

- [ ] **Step 5: Verify Runtime Console tests pass**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui-events.ts src/components/apps/ClawRuntimeConsoleAppWindow.tsx src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
git commit -m "feat: pass record focus metadata from runtime console"
```

### Task 3: Focus Deal Desk From Sales Asset Prefill

**Files:**

- Modify: `src/components/apps/DealDeskAppWindow.tsx`
- Create: `src/__tests__/components/DealDeskAppWindow.test.tsx`

- [ ] **Step 1: Write failing Deal Desk focus test**

Create `src/__tests__/components/DealDeskAppWindow.test.tsx`:

```ts
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealDeskAppWindow } from "@/components/apps/DealDeskAppWindow";
import { createDeal, getDeals } from "@/lib/deals";
import { upsertSalesAsset } from "@/lib/sales-assets";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="deal-desk-window">{children}</div>
  ),
}));

vi.mock("@/components/workflows/SalesHeroWorkflowPanel", () => ({
  SalesHeroWorkflowPanel: () => <div data-testid="sales-workflow-panel" />,
}));

vi.mock("@/components/recommendations/RecommendationResultBody", () => ({
  RecommendationResultBody: () => <div data-testid="recommendation-result" />,
}));

vi.mock("@/lib/openclaw-agent-client", () => ({
  requestOpenClawAgent: vi.fn(),
  requestRealityCheck: vi.fn(),
}));

vi.mock("@/lib/ui-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ui-events")>("@/lib/ui-events");
  return {
    ...actual,
    requestComposeEmail: vi.fn(),
  };
});

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: {} })),
  );
});

describe("DealDeskAppWindow record-level asset focus", () => {
  it("selects the existing deal for a sales asset prefill without creating a new lead", async () => {
    const dealId = createDeal({
      company: "Focused Facades",
      contact: "Nora",
      workflowRunId: "workflow-focus-1",
      workflowScenarioId: "sales-pipeline",
    });
    const asset = upsertSalesAsset("workflow-focus-1", {
      scenarioId: "sales-pipeline",
      dealId,
      company: "Focused Facades",
      contactName: "Nora",
      requirementSummary: "Approved quote context",
    });

    render(
      <DealDeskAppWindow
        state="open"
        zIndex={1}
        active
        onFocus={vi.fn()}
        onMinimize={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    window.dispatchEvent(
      new CustomEvent("openclaw:deal-desk-prefill", {
        detail: {
          assetId: asset.id,
          workflowRunId: "workflow-focus-1",
          workflowSource: "Runtime Console asset",
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Focused Facades")).toBeInTheDocument();
    });
    expect(getDeals()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verify Deal Desk test fails**

Run:

```bash
npm test -- src/__tests__/components/DealDeskAppWindow.test.tsx
```

Expected: FAIL because the prefill handler creates a new lead instead of focusing the existing sales asset/deal.

- [ ] **Step 3: Implement record focus branch**

Update imports in `src/components/apps/DealDeskAppWindow.tsx`:

```ts
import {
  getSalesAssetById,
  getSalesAssetByWorkflowRunId,
  subscribeSalesAssets,
  upsertSalesAsset,
} from "@/lib/sales-assets";
```

Replace the `onPrefill` handler body with:

```ts
const onPrefill = (event: Event) => {
  const detail = (event as CustomEvent<DealDeskPrefill>).detail;
  const focusAsset =
    getSalesAssetById(detail?.assetId) ??
    getSalesAssetByWorkflowRunId(detail?.workflowRunId);

  if (focusAsset) {
    const targetDeal =
      getDeals().find((deal) => deal.id === focusAsset.dealId) ??
      getDeals().find((deal) => deal.workflowRunId === focusAsset.workflowRunId) ??
      null;
    if (targetDeal) {
      setSelectedId(targetDeal.id);
      showToast("已定位到销售资产关联线索", "ok");
      return;
    }
    showToast("已打开 Deal Desk，未找到关联线索", "error");
    return;
  }

  const hasRecordFocus = Boolean(detail?.assetId || detail?.sourceKey || detail?.workflowRunId);
  if (hasRecordFocus && !detail?.company && !detail?.need) {
    showToast("已打开 Deal Desk，未找到目标销售资产", "error");
    return;
  }

  const id = createDeal({
    company: detail?.company ?? "",
    contact: detail?.contact ?? "",
    inquiryChannel: detail?.inquiryChannel ?? "",
    preferredLanguage: detail?.preferredLanguage ?? "",
    productLine: detail?.productLine ?? "",
    need: detail?.need ?? "",
    budget: detail?.budget ?? "",
    timing: detail?.timing ?? "",
    notes: detail?.notes ?? "",
    stage: detail?.stage ?? "new",
    ...buildSalesWorkflowMeta(detail),
  });
  setSelectedId(id);
  showToast("已带入线索上下文", "ok");
};
```

- [ ] **Step 4: Verify Deal Desk test passes**

Run:

```bash
npm test -- src/__tests__/components/DealDeskAppWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/apps/DealDeskAppWindow.tsx src/__tests__/components/DealDeskAppWindow.test.tsx
git commit -m "feat: focus deal desk from sales asset landings"
```

### Task 4: Focus Knowledge Vault From Knowledge Asset Prefill

**Files:**

- Modify: `src/components/apps/KnowledgeVaultAppWindow.tsx`
- Create: `src/__tests__/components/KnowledgeVaultAppWindow.test.tsx`

- [ ] **Step 1: Write failing Knowledge Vault focus test**

Create `src/__tests__/components/KnowledgeVaultAppWindow.test.tsx`:

```ts
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeVaultAppWindow } from "@/components/apps/KnowledgeVaultAppWindow";
import { upsertKnowledgeAsset } from "@/lib/knowledge-assets";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="knowledge-vault-window">{children}</div>
  ),
}));

vi.mock("@/components/recommendations/RecommendationResultBody", () => ({
  RecommendationResultBody: () => <div data-testid="recommendation-result" />,
}));

vi.mock("@/components/workflows/useRuntimeHeroWorkflowSummary", () => ({
  useRuntimeHeroWorkflowSummary: () => ({
    recommendations: {},
    phase: "idle",
    error: "",
    syncedAt: null,
    refresh: vi.fn(),
    refreshKey: "test",
  }),
}));

vi.mock("@/lib/asset-jumps", () => ({
  jumpToAssetTarget: vi.fn(),
}));

vi.mock("@/lib/ui-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ui-events")>("@/lib/ui-events");
  return {
    ...actual,
    requestOpenDealDesk: vi.fn(),
    requestOpenSupportCopilot: vi.fn(),
  };
});

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: { creatorAssets: [] } })),
  );
});

describe("KnowledgeVaultAppWindow record-level asset focus", () => {
  it("focuses a knowledge asset from prefill metadata", async () => {
    const asset = upsertKnowledgeAsset("controlled-run:run-1:knowledge_asset", {
      title: "Focused knowledge asset",
      body: "Approved controlled run learning.",
      sourceApp: "personal_crm",
      scenarioId: "sales-pipeline",
      workflowRunId: "workflow-focus-1",
      assetType: "sales_playbook",
      status: "active",
      tags: ["sales"],
      applicableScene: "Door and window inquiry",
    });

    render(
      <KnowledgeVaultAppWindow
        state="open"
        zIndex={1}
        active
        onFocus={vi.fn()}
        onMinimize={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    window.dispatchEvent(
      new CustomEvent("openclaw:vault-prefill", {
        detail: {
          assetId: asset.id,
          sourceKey: asset.sourceKey,
          workflowRunId: "workflow-focus-1",
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Focused knowledge asset")).toBeInTheDocument();
    });
    expect(screen.getByText("已聚焦")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify Knowledge Vault test fails**

Run:

```bash
npm test -- src/__tests__/components/KnowledgeVaultAppWindow.test.tsx
```

Expected: FAIL because vault prefill does not resolve or highlight a specific asset.

- [ ] **Step 3: Implement focused asset state and lookup**

Update imports in `src/components/apps/KnowledgeVaultAppWindow.tsx`:

```ts
import {
  getKnowledgeAssetById,
  getKnowledgeAssetBySourceKey,
  getKnowledgeAssets,
  incrementKnowledgeAssetReuse,
  removeKnowledgeAsset,
  setKnowledgeAssetStatus,
  subscribeKnowledgeAssets,
  updateKnowledgeAsset,
  type KnowledgeAssetRecord,
} from "@/lib/knowledge-assets";
```

Add state near the other asset state:

```ts
const [focusedAssetId, setFocusedAssetId] = useState<string | null>(null);
```

Replace the vault prefill handler with:

```ts
const onPrefill = (event: Event) => {
  const detail = (event as CustomEvent<KnowledgeVaultPrefill>).detail;
  const focusedAsset =
    getKnowledgeAssetById(detail?.assetId) ??
    getKnowledgeAssetBySourceKey(detail?.sourceKey);
  if (focusedAsset) {
    setFocusedAssetId(focusedAsset.id);
    setQuery(focusedAsset.title);
    setAsk(detail?.query ?? focusedAsset.title);
    setAnswer("");
    setStructuredAnswer(null);
    showToast("已定位到知识资产", "ok");
    return;
  }
  setFocusedAssetId(null);
  setAsk(detail?.query ?? "");
  setAnswer("");
  setStructuredAnswer(null);
  showToast("已带入知识库问题", "ok");
};
```

In the asset row map, compute focus:

```ts
const focused = asset.id === focusedAssetId;
```

Change the row wrapper class:

```tsx
<div
  key={asset.id}
  className={[
    "px-5 py-4",
    focused ? "bg-sky-50/70 ring-1 ring-inset ring-sky-200" : "",
  ].join(" ")}
>
```

Next to the title, show the focus badge:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <div className="text-sm font-semibold text-gray-900">{asset.title}</div>
  {focused ? (
    <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700">
      已聚焦
    </span>
  ) : null}
</div>
```

- [ ] **Step 4: Verify Knowledge Vault test passes**

Run:

```bash
npm test -- src/__tests__/components/KnowledgeVaultAppWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/apps/KnowledgeVaultAppWindow.tsx src/__tests__/components/KnowledgeVaultAppWindow.test.tsx
git commit -m "feat: focus knowledge vault asset landings"
```

### Task 5: Update Controlled Runtime Regression Coverage

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Add new tests to `test:controlled-runtime`**

In `package.json`, append these files to the `test:controlled-runtime` script:

```text
src/__tests__/lib/asset-record-focus.test.ts
src/__tests__/components/DealDeskAppWindow.test.tsx
src/__tests__/components/KnowledgeVaultAppWindow.test.tsx
```

Keep the existing files in the script.

- [ ] **Step 2: Verify controlled runtime regression passes**

Run:

```bash
npm run test:controlled-runtime
```

Expected: PASS with the prior 17 files plus the 3 new files.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "test: cover record-level asset focus in controlled runtime"
```

### Task 6: Final Verification And Documentation

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/superpowers/plans/2026-07-06-runtime-console-record-level-asset-focus.md`
- Optionally modify ignored local memory: `memory/2026-07-06.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
```

Expected:

- `test:controlled-runtime`: PASS.
- `test:core-workflows`: PASS.
- `lint`: exit 0 with only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `build`: exit 0 with the same existing warning.

- [ ] **Step 2: Update docs**

Update:

- `CHANGELOG.md`: add a `Runtime Console Record-Level Asset Focus` bullet group under `Unreleased`.
- `docs/NEXT_STEPS.md`: move P0 Record-Level Asset Focus to completed baseline and promote `Complete Skipped Writeback Targets` to P0.
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`: record Phase 7c as completed and set the next default phase to skipped writeback target completion.
- This plan: mark completed checklist items and add final verification results.
- `memory/2026-07-06.md`: note commits, final verification, and next phase if local memory maintenance is active.

- [ ] **Step 3: Verify docs formatting**

Run:

```bash
git diff --check
```

Expected: no output, exit 0.

- [ ] **Step 4: Commit docs**

```bash
git add CHANGELOG.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/NEXT_STEPS.md docs/superpowers/plans/2026-07-06-runtime-console-record-level-asset-focus.md
git commit -m "docs: track record-level asset focus"
```

## Self-Review

- Spec coverage: prefill contracts, lookup helpers, Runtime Console metadata forwarding, Deal Desk focus, Knowledge Vault focus, fallbacks, tests, and docs are covered.
- Placeholder scan: no incomplete placeholder markers.
- Type consistency: `assetId`, `sourceKey`, and `workflowRunId` are used consistently across spec, plan, UI prefill types, and tests.

## Execution Record

- Task 1 completed in `ecdaed4` (`feat: add record-level asset lookup helpers`).
  - Verification: `npm test -- src/__tests__/lib/asset-record-focus.test.ts` passed.
  - Spec review: approved.
  - Code quality review: approved, with unrelated existing `tsc --noEmit` failures noted outside this task.
- Task 2 completed across `c953b8d`, `0470756`, and `fb0e9f9`.
  - `c953b8d`: extended prefill contracts and Runtime Console record metadata forwarding.
  - `0470756`: added sales `sourceKey` assertion to Runtime Console component coverage.
  - `fb0e9f9`: added production sales asset receipt `sourceKey` and lower-level writeback coverage.
  - Verification: `npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx` passed.
  - Verification: `npm test -- src/__tests__/lib/executor/runtime/writeback.test.ts` passed.
  - Spec review: approved after the sales `sourceKey` assertion was added.
  - Code quality review: approved after production sales receipt `sourceKey` generation was added.
- Task 3 completed across `5d552d0` and `f09a05c`.
  - `5d552d0`: made Deal Desk focus an existing deal from sales asset prefill metadata.
  - `f09a05c`: strengthened the component test so it proves selection moves from another deal to the target deal.
  - Verification: `npm test -- src/__tests__/components/DealDeskAppWindow.test.tsx` passed.
  - Spec review: approved after the selection-proof test was added.
  - Code quality review: approved with non-blocking notes about future test isolation and fallback coverage.
- Task 4 completed across `454febb` and `38fa71c`.
  - `454febb`: made Knowledge Vault resolve `assetId` / `sourceKey` prefill metadata and render a focused row marker.
  - `38fa71c`: reset the status filter to `all` when focusing so the target asset remains visible.
  - Verification: `npm test -- src/__tests__/components/KnowledgeVaultAppWindow.test.tsx` passed.
  - Spec review: approved after the hidden-by-filter case was fixed.
  - Code quality review: approved with non-blocking notes about future focus clearing and JSX readability.
- Task 5 completed in `581cb75` (`test: cover record-level asset focus in controlled runtime`).
  - `test:controlled-runtime` now includes asset lookup, Deal Desk focus, and Knowledge Vault focus coverage.
  - Verification: `npm run test:controlled-runtime` passed with 20 files and 115 tests.
- Task 6 completed in final documentation pass.
  - Updated changelog, next steps, controlled runtime manual, this plan, and local daily memory.
  - Final verification:
    - `npm run test:controlled-runtime` passed: 20 files, 115 tests.
    - `npm run test:core-workflows` passed.
    - `npm run lint` passed with the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
    - `npm run build` passed with the same existing `<img>` warning.
  - Next phase: Complete Skipped Writeback Targets for `workflow_run` and `draft`.
