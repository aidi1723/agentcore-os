# Runtime Console Workflow And Draft Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Runtime Console open `workflow_run` and `draft` writeback records from the same landing panel that already opens sales and knowledge assets.

**Architecture:** Extend the existing controlled run console summary landing mapper from two supported targets to four. Reuse existing cross-app prefill events: add a narrow Industry Hub workflow focus prefill and reuse Publisher's existing `draftId` prefill. Keep the Runtime Console UI structure unchanged and only add open actions for the new landing types.

**Tech Stack:** TypeScript, React, Next.js, Vitest, Testing Library, existing runtime event helpers and JSON-backed stores.

---

Spec: [Runtime Console Workflow And Draft Deep Links Design](../specs/2026-07-06-runtime-console-workflow-draft-deep-links-design.md)

## File Structure

Modify:

- `src/lib/executor/runtime/console-summary.ts`
  - Add `workflow_run` and `draft` landing labels and app ids.
  - Widen `ControlledRunAssetLandingSummary["appId"]`.

- `src/__tests__/lib/executor/runtime/console-summary.test.ts`
  - Prove workflow/draft landings are summarized and searchable.

- `src/lib/ui-events.ts`
  - Add `IndustryHubPrefill`.
  - Add `requestOpenIndustryHub`.
  - Dispatch `openclaw:industry-hub-prefill` through `dispatchOpenAppPrefill`.

- `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`
  - Import `requestOpenIndustryHub` and `requestOpenPublisher`.
  - Route `workflow_run` and `draft` landings to their target apps.

- `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
  - Mock and assert workflow/draft open helper calls.

- `src/components/apps/IndustryHubAppWindow.tsx`
  - Listen for `openclaw:industry-hub-prefill`.
  - Select the role/scenario that owns the focused workflow run.

- `src/__tests__/components/IndustryHubAppWindow.test.tsx`
  - Add focused workflow run prefill regression.

Docs after implementation:

- `CHANGELOG.md`
- `docs/NEXT_STEPS.md`
- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- `memory/2026-07-06.md`

## Task 1: Summary Landing Model

**Files:**

- Modify: `src/__tests__/lib/executor/runtime/console-summary.test.ts`
- Modify: `src/lib/executor/runtime/console-summary.ts`

- [ ] **Step 1: Write failing summary test for workflow and draft landings**

In `src/__tests__/lib/executor/runtime/console-summary.test.ts`, change the `makeRun()` fixture:

1. Replace the `intake` writeback receipt with a successful workflow receipt:

```ts
writebackReceipts: [
  {
    target: "workflow_run",
    ok: true,
    summary: "Wrote workflow run workflow-1 as completed",
    writtenAt: 160,
    sourceKey: "controlled-run:run-console-1:workflow_run",
    workflowRunId: "workflow-1",
  },
],
```

2. Add a successful draft receipt to the `human_review` step:

```ts
writebackReceipts: [
  {
    target: "draft",
    ok: true,
    summary: "Wrote draft controlled-draft:workflow-1",
    writtenAt: 190,
    assetId: "controlled-draft:workflow-1",
    sourceKey: "controlled-run:run-console-1:draft",
    workflowRunId: "workflow-1",
  },
],
```

3. Update the first test expectations:

```ts
expect(summary.writebackReceiptCount).toBe(4);
expect(summary.assetLandings).toEqual([
  {
    target: "workflow_run",
    label: "Workflow run",
    detail: "Wrote workflow run workflow-1 as completed",
    ok: true,
    sourceKey: "controlled-run:run-console-1:workflow_run",
    workflowRunId: "workflow-1",
    appId: "industry_hub",
  },
  {
    target: "draft",
    label: "Draft",
    detail: "Wrote draft controlled-draft:workflow-1",
    ok: true,
    assetId: "controlled-draft:workflow-1",
    sourceKey: "controlled-run:run-console-1:draft",
    workflowRunId: "workflow-1",
    appId: "publisher",
  },
  {
    target: "sales_asset",
    label: "Sales asset",
    detail: "Wrote sales asset controlled-sales-asset:workflow-1 for workflow workflow-1",
    ok: true,
    assetId: "controlled-sales-asset:workflow-1",
    workflowRunId: "workflow-1",
    appId: "deal_desk",
  },
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
  },
]);
```

4. Update the step receipt assertions:

```ts
expect(summary.steps[0]).toMatchObject({
  id: "intake",
  title: "Intake",
  state: "completed",
  schemaValid: true,
  receiptCount: 1,
});
expect(summary.steps[1]).toMatchObject({
  id: "human_review",
  approvalState: "approved",
  approvalFeedback: "ok",
  receiptCount: 1,
});
expect(summary.steps[2].writebackReceipts.map((receipt) => receipt.target)).toEqual([
  "sales_asset",
  "knowledge_asset",
]);
```

5. Add search assertions to the filter test:

```ts
expect(
  filterControlledRunConsoleSummaries([completed, awaiting], {
    state: "all",
    query: "controlled-draft:workflow-1",
  }).map((summary) => summary.id),
).toEqual(["run-console-1"]);

expect(
  filterControlledRunConsoleSummaries([completed, awaiting], {
    state: "all",
    query: "Workflow run",
  }).map((summary) => summary.id),
).toEqual(["run-console-1"]);
```

- [ ] **Step 2: Verify summary test fails**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: FAIL because `workflow_run` and `draft` are not included in `assetLandings`, and their app ids are not recognized.

- [ ] **Step 3: Implement summary landing support**

In `src/lib/executor/runtime/console-summary.ts`, update the landing app id type:

```ts
appId?: "deal_desk" | "knowledge_vault" | "industry_hub" | "publisher";
```

Replace the label/app maps:

```ts
const LANDING_LABELS: Record<string, string> = {
  workflow_run: "Workflow run",
  draft: "Draft",
  sales_asset: "Sales asset",
  knowledge_asset: "Knowledge asset",
};

const LANDING_APP_IDS: Record<string, ControlledRunAssetLandingSummary["appId"]> = {
  workflow_run: "industry_hub",
  draft: "publisher",
  sales_asset: "deal_desk",
  knowledge_asset: "knowledge_vault",
};

const LANDING_TARGETS = new Set(Object.keys(LANDING_LABELS));
```

Replace `buildAssetLandings` with:

```ts
function buildAssetLandings(
  receipts: ControlledWritebackReceipt[],
): ControlledRunAssetLandingSummary[] {
  return receipts
    .filter((receipt) => LANDING_TARGETS.has(receipt.target))
    .map((receipt) => ({
      target: receipt.target,
      label: LANDING_LABELS[receipt.target] ?? receipt.target,
      detail: receipt.summary,
      ok: receipt.ok,
      assetId: receipt.assetId,
      sourceKey: receipt.sourceKey,
      workflowRunId: receipt.workflowRunId,
      appId: LANDING_APP_IDS[receipt.target],
    }));
}
```

- [ ] **Step 4: Verify summary test passes**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit summary model**

```bash
git add src/lib/executor/runtime/console-summary.ts src/__tests__/lib/executor/runtime/console-summary.test.ts
git commit -m "feat: summarize workflow and draft landings"
```

## Task 2: Runtime Console Open Actions

**Files:**

- Modify: `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`
- Modify: `src/lib/ui-events.ts`
- Modify: `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`

- [ ] **Step 1: Write failing Runtime Console open action test**

In `src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx`, update the imports:

```ts
import {
  requestOpenDealDesk,
  requestOpenIndustryHub,
  requestOpenKnowledgeVault,
  requestOpenPublisher,
} from "@/lib/ui-events";
```

Update the `@/lib/ui-events` mock:

```ts
vi.mock("@/lib/ui-events", () => ({
  requestOpenDealDesk: vi.fn(),
  requestOpenIndustryHub: vi.fn(),
  requestOpenKnowledgeVault: vi.fn(),
  requestOpenPublisher: vi.fn(),
  requestOpenSettings: vi.fn(),
}));
```

Add workflow and draft receipts to `buildCompletedRunWithAssetLandings()` after the knowledge receipt:

```ts
{
  target: "workflow_run",
  ok: true,
  summary: "Wrote workflow run workflow-assets-1 as completed",
  writtenAt: 2,
  sourceKey: "controlled-run:run-assets-1:workflow_run",
  workflowRunId: "workflow-assets-1",
},
{
  target: "draft",
  ok: true,
  summary: "Wrote draft controlled-draft:workflow-assets-1",
  writtenAt: 2,
  assetId: "controlled-draft:workflow-assets-1",
  sourceKey: "controlled-run:run-assets-1:draft",
  workflowRunId: "workflow-assets-1",
},
```

Update `passes record focus metadata when opening controlled run asset landings`:

```ts
const openButtons = await screen.findAllByRole("button", { name: "打开" });
expect(openButtons).toHaveLength(4);
fireEvent.click(openButtons[0]);
fireEvent.click(openButtons[1]);
```

Add a new test:

```ts
it("opens workflow run and draft landings with focused prefill", async () => {
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

  await waitFor(() => {
    expect(screen.getAllByText("Asset landing run").length).toBeGreaterThan(0);
  });

  const openButtons = await screen.findAllByRole("button", { name: "打开" });
  expect(openButtons).toHaveLength(4);
  fireEvent.click(openButtons[2]);
  fireEvent.click(openButtons[3]);

  expect(requestOpenIndustryHub).toHaveBeenCalledWith({
    workflowRunId: "workflow-assets-1",
    scenarioId: "sales-pipeline",
  });
  expect(requestOpenPublisher).toHaveBeenCalledWith(
    expect.objectContaining({
      draftId: "controlled-draft:workflow-assets-1",
      workflowRunId: "workflow-assets-1",
      workflowScenarioId: "sales-pipeline",
      workflowSource: "Runtime Console asset controlled-draft:workflow-assets-1",
      workflowNextStep:
        "Review the controlled run draft and decide whether to publish or revise.",
    }),
  );
});
```

- [ ] **Step 2: Verify Runtime Console open action test fails**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: FAIL because `requestOpenIndustryHub` / `requestOpenPublisher` are not imported or called.

- [ ] **Step 3: Add Industry Hub open helper**

In `src/lib/ui-events.ts`, add this type after `SettingsTargetTab`:

```ts
export type IndustryHubPrefill = {
  workflowRunId?: string;
  scenarioId?: string;
};
```

Add it to `OpenAppDetail`:

```ts
industryHubPrefill?: IndustryHubPrefill;
```

Add the helper after `requestOpenSettings`:

```ts
export function requestOpenIndustryHub(prefill?: IndustryHubPrefill) {
  requestOpenApp("industry_hub", { industryHubPrefill: prefill });
}
```

Add the dispatch in `dispatchOpenAppPrefill` before the deal desk dispatch:

```ts
dispatchPrefill(
  "openclaw:industry-hub-prefill",
  appId === "industry_hub" ? detail.industryHubPrefill : undefined,
);
```

- [ ] **Step 4: Route Runtime Console workflow/draft landings**

In `src/components/apps/ClawRuntimeConsoleAppWindow.tsx`, update the `@/lib/ui-events` import:

```ts
import {
  requestOpenDealDesk,
  requestOpenIndustryHub,
  requestOpenKnowledgeVault,
  requestOpenPublisher,
  requestOpenSettings,
} from "@/lib/ui-events";
```

Add these branches to `handleOpenControlledRunAsset` after the knowledge vault branch:

```ts
    if (asset.appId === "industry_hub") {
      requestOpenIndustryHub({
        workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary?.workflowRunId,
        scenarioId: selectedControlledRunSummary?.scenarioId,
      });
      showToast("已打开 Industry Hub", "ok");
      return;
    }

    if (asset.appId === "publisher") {
      if (!asset.assetId) {
        showToast("草稿记录缺少 draftId", "error");
        return;
      }
      requestOpenPublisher({
        draftId: asset.assetId,
        workflowRunId: asset.workflowRunId ?? selectedControlledRunSummary?.workflowRunId,
        workflowScenarioId: selectedControlledRunSummary?.scenarioId,
        workflowSource: `Runtime Console asset ${asset.assetId ?? asset.target}`,
        workflowNextStep:
          "Review the controlled run draft and decide whether to publish or revise.",
      });
      showToast("已打开 Publisher", "ok");
    }
```

- [ ] **Step 5: Verify Runtime Console test passes**

Run:

```bash
npm test -- src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
```

Expected: PASS, with the existing sales/knowledge tests still green.

- [ ] **Step 6: Commit open actions**

```bash
git add src/lib/ui-events.ts src/components/apps/ClawRuntimeConsoleAppWindow.tsx src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx
git commit -m "feat: open workflow and draft landings"
```

## Task 3: Industry Hub Workflow Focus Prefill

**Files:**

- Create: `src/__tests__/components/IndustryHubAppWindow.test.tsx`
- Modify: `src/components/apps/IndustryHubAppWindow.tsx`

- [ ] **Step 1: Write failing Industry Hub prefill test**

Create `src/__tests__/components/IndustryHubAppWindow.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IndustryHubAppWindow } from "@/components/apps/IndustryHubAppWindow";
import { getWorkspaceScenario } from "@/lib/workspace-presets";
import { getWorkflowRun, startWorkflowRun } from "@/lib/workflow-runs";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="industry-hub-window">{children}</div>
  ),
}));

vi.mock("@/components/AppToast", () => ({
  AppToast: () => null,
}));

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>();
  return {
    ...actual,
    loadSettings: () => actual.defaultSettings,
    saveSettings: vi.fn(),
  };
});

vi.mock("@/lib/ui-events", () => ({
  requestOpenApp: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
});

describe("IndustryHubAppWindow workflow focus prefill", () => {
  it("selects the role desk for an existing workflow run from prefill", async () => {
    const salesScenario = getWorkspaceScenario("sales-pipeline");
    expect(salesScenario).not.toBeNull();
    const runId = startWorkflowRun(salesScenario!, "manual");
    expect(getWorkflowRun(runId)?.scenarioId).toBe("sales-pipeline");

    render(
      <IndustryHubAppWindow
        state="open"
        zIndex={1}
        active
        onFocus={vi.fn()}
        onMinimize={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Creator Desk")).toBeInTheDocument();

    fireEvent(
      window,
      new CustomEvent("openclaw:industry-hub-prefill", {
        detail: { workflowRunId: runId, scenarioId: "sales-pipeline" },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Sales Desk")).toBeInTheDocument();
      expect(screen.getByText(/当前运行流：/)).toHaveTextContent("销售 Pipeline");
    });
  });
});
```

- [ ] **Step 2: Verify Industry Hub test fails**

Run:

```bash
npm test -- src/__tests__/components/IndustryHubAppWindow.test.tsx
```

Expected: FAIL because `IndustryHubAppWindow` does not listen for `openclaw:industry-hub-prefill`.

- [ ] **Step 3: Implement Industry Hub focus listener**

In `src/components/apps/IndustryHubAppWindow.tsx`, update imports:

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
```

```ts
import { requestOpenApp, type IndustryHubPrefill } from "@/lib/ui-events";
```

Add this callback before the existing workflow-runs subscription effect:

```ts
  const focusWorkflowRun = useCallback(
    (detail?: IndustryHubPrefill | null) => {
      const workflowRunId = detail?.workflowRunId?.trim();
      const scenarioId = detail?.scenarioId?.trim();
      const runs = getWorkflowRuns();
      const run =
        (workflowRunId ? runs.find((item) => item.id === workflowRunId) ?? null : null) ??
        (scenarioId ? runs.find((item) => item.scenarioId === scenarioId) ?? null : null);
      if (!run) {
        showToast("未找到对应 workflow run", "error");
        return;
      }
      const role = workspaceRoleDesks.find((item) => item.scenarioId === run.scenarioId);
      if (role) {
        setSelectedRoleId(role.id);
      }
      const industry = industries.find(
        (item) => mapIndustryToWorkspaceIndustry(item.id) === getWorkspaceScenario(run.scenarioId)?.industryId,
      );
      if (industry) {
        setIndustryId(industry.id);
      }
      setWorkflowRuns(runs);
      showToast("已定位 workflow run", "ok");
    },
    [showToast],
  );
```

Add this effect after the workflow-runs subscription effect:

```ts
  useEffect(() => {
    const onPrefill = (event: Event) => {
      focusWorkflowRun((event as CustomEvent<IndustryHubPrefill>).detail);
    };
    window.addEventListener("openclaw:industry-hub-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:industry-hub-prefill", onPrefill);
  }, [focusWorkflowRun]);
```

- [ ] **Step 4: Verify Industry Hub test passes**

Run:

```bash
npm test -- src/__tests__/components/IndustryHubAppWindow.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Industry Hub focus**

```bash
git add src/components/apps/IndustryHubAppWindow.tsx src/__tests__/components/IndustryHubAppWindow.test.tsx
git commit -m "feat: focus workflow runs in industry hub"
```

## Task 4: Documentation And Final Verification

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `docs/NEXT_STEPS.md`
- Modify: `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
- Modify: `docs/superpowers/plans/2026-07-06-runtime-console-workflow-draft-deep-links.md`
- Modify: `memory/2026-07-06.md`

- [ ] **Step 1: Run targeted implementation tests**

Run:

```bash
npm test -- src/__tests__/lib/executor/runtime/console-summary.test.ts src/__tests__/components/ClawRuntimeConsoleAppWindow.test.tsx src/__tests__/components/IndustryHubAppWindow.test.tsx
```

Expected: PASS. The controlled runtime targeted tests should include the new summary/open/focus coverage.

- [ ] **Step 2: Run final gates**

Run:

```bash
npm run test:controlled-runtime
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

Expected:

- `test:controlled-runtime` passes.
- `test:core-workflows` passes.
- `lint` exits 0 with only the existing `<img>` warning in `src/__tests__/components/ShellUI.test.tsx`.
- `build` exits 0 with the same existing warning.
- `git diff --check` exits 0.

- [ ] **Step 3: Update docs**

Update:

- `CHANGELOG.md`
  - Add Runtime Console workflow/draft deep links under Unreleased.
  - Update verification count if `test:controlled-runtime` file/test count changes.

- `docs/NEXT_STEPS.md`
  - Move `Runtime Console Workflow And Draft Deep Links` from P0 to completed.
  - Set next recommended P0 to `Support Playbook Migration`.

- `docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md`
  - Mark Phase 7e complete.
  - Update current progress snapshot.
  - Set next default phase to Support Playbook Migration.

- `memory/2026-07-06.md`
  - Record commits and final verification results.

- [ ] **Step 4: Mark plan progress complete**

In this plan file, mark completed checkboxes for tasks and add final verification evidence:

```md
- `npm run test:controlled-runtime` — N files / N tests passed.
- `npm run test:core-workflows` — all core workflow regressions passed.
- `npm run lint` — exit 0 with the existing `<img>` warning.
- `npm run build` — exit 0 with the same warning.
- `git diff --check` — exit 0.
```

- [ ] **Step 5: Commit docs**

```bash
git add CHANGELOG.md docs/NEXT_STEPS.md docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md docs/superpowers/plans/2026-07-06-runtime-console-workflow-draft-deep-links.md
git commit -m "docs: complete workflow draft deep links"
```

## Self-Review

- Spec coverage: summary mapping, search, open actions, Industry Hub focus, Publisher prefill, existing sales/knowledge preservation, docs, and verification are covered.
- Placeholder scan: no placeholders are intentionally left.
- Type consistency: `IndustryHubPrefill`, `requestOpenIndustryHub`, `publisherPrefill.draftId`, and app ids match existing naming conventions.
